"""Local durable outbox for call events (call_started / call_ended / recording_ready).

Write is fast and local so it can't be interrupted by process shutdown.
A separate delivery worker (not in this file) drains it and does the
actual network send, with retries.
"""

import json
import logging
import os
import random
import sqlite3
import time

logger = logging.getLogger("whispey_outbox")

_DB_PATH = os.environ.get("WHISPEY_OUTBOX_PATH", "/tmp/whispey_outbox.db")
_MAX_ATTEMPTS = 10
_MAX_BACKOFF_SECONDS = 300
_STALE_CLAIM_SECONDS = 300  # a claim this old is treated as abandoned


def _backoff_seconds(attempts: int) -> float:
    base = min(2 ** attempts, _MAX_BACKOFF_SECONDS)
    return base + random.uniform(0, base * 0.2)  # jitter


def _safe_close(conn):
    """conn.close() can itself raise. If it does after a commit already
    succeeded, letting it propagate from a `finally` would discard the
    result and make an already-durable write look like it failed —
    triggering a needless (and duplicate-risking) fallback upstream."""
    try:
        conn.close()
    except Exception as e:
        logger.warning(f"[OUTBOX] connection close failed (write/commit already done): {e}")


def _connect():
    conn = sqlite3.connect(_DB_PATH, timeout=5)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            call_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at REAL NOT NULL,
            next_attempt_at REAL NOT NULL DEFAULT 0,
            claimed_at REAL,
            last_error TEXT
        )
        """
    )
    return conn


def write_entry(call_id: str, event_type: str, payload: dict) -> int:
    """Fast, durable write. Call this before anything risky (network, shutdown)."""
    conn = _connect()
    try:
        now = time.time()
        cur = conn.execute(
            "INSERT INTO outbox (call_id, event_type, payload, created_at, next_attempt_at) VALUES (?, ?, ?, ?, ?)",
            (call_id, event_type, json.dumps(payload), now, now),
        )
        conn.commit()
        logger.info(f"[OUTBOX] wrote entry id={cur.lastrowid} call_id={call_id} event={event_type}")
        return cur.lastrowid
    finally:
        _safe_close(conn)


def claim_pending(limit: int = 10):
    """Atomically claim up to `limit` entries for delivery: pending ones whose
    backoff has elapsed, plus in_progress ones abandoned by a worker that
    died mid-drain (claimed longer than _STALE_CLAIM_SECONDS ago)."""
    conn = _connect()
    try:
        now = time.time()
        conn.execute("BEGIN IMMEDIATE")
        rows = conn.execute(
            "SELECT id, call_id, event_type, payload, attempts FROM outbox "
            "WHERE (status = 'pending' AND next_attempt_at <= ?) "
            "   OR (status = 'in_progress' AND claimed_at <= ?) "
            "ORDER BY created_at LIMIT ?",
            (now, now - _STALE_CLAIM_SECONDS, limit),
        ).fetchall()
        ids = [r[0] for r in rows]
        if ids:
            conn.executemany(
                "UPDATE outbox SET status = 'in_progress', claimed_at = ? WHERE id = ?",
                [(now, i) for i in ids],
            )
        conn.commit()
        if ids:
            logger.info(f"[OUTBOX] claimed {len(ids)} entr(ies): ids={ids}")
        return [
            {"id": r[0], "call_id": r[1], "event_type": r[2], "payload": json.loads(r[3]), "attempts": r[4]}
            for r in rows
        ]
    finally:
        _safe_close(conn)


def mark_delivered(entry_id: int):
    conn = _connect()
    try:
        conn.execute("DELETE FROM outbox WHERE id = ?", (entry_id,))
        conn.commit()
        logger.info(f"[OUTBOX] delivered id={entry_id}")
    finally:
        _safe_close(conn)


def mark_failed(entry_id: int, error: str):
    """Bump attempts and reset to pending for retry, or dead-letter past the cap."""
    conn = _connect()
    try:
        row = conn.execute("SELECT attempts FROM outbox WHERE id = ?", (entry_id,)).fetchone()
        if row is None:
            return
        attempts = row[0] + 1
        status = "dead" if attempts >= _MAX_ATTEMPTS else "pending"
        next_attempt_at = time.time() + _backoff_seconds(attempts)
        conn.execute(
            "UPDATE outbox SET status = ?, attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?",
            (status, attempts, error, next_attempt_at, entry_id),
        )
        conn.commit()
        if status == "dead":
            logger.error(f"[OUTBOX] id={entry_id} DEAD-LETTERED after {attempts} attempts: {error}")
        else:
            logger.warning(f"[OUTBOX] id={entry_id} failed (attempt {attempts}), retry in {_backoff_seconds(attempts):.0f}s: {error}")
    finally:
        _safe_close(conn)


def pending_count() -> int:
    conn = _connect()
    try:
        return conn.execute("SELECT COUNT(*) FROM outbox WHERE status != 'dead'").fetchone()[0]
    finally:
        _safe_close(conn)


def _demo():
    global _DB_PATH
    _DB_PATH = "/tmp/whispey_outbox_demo.db"
    if os.path.exists(_DB_PATH):
        os.remove(_DB_PATH)

    entry_id = write_entry("call_123", "call_ended", {"transcript": "hello"})
    assert pending_count() == 1

    claimed = claim_pending()
    assert len(claimed) == 1 and claimed[0]["id"] == entry_id

    # a second claim while still in_progress should find nothing
    assert claim_pending() == []

    mark_failed(entry_id, "simulated network error")
    assert pending_count() == 1  # back to pending, retryable
    assert claim_pending() == []  # backoff not elapsed yet — must not claim early

    conn = _connect()
    conn.execute("UPDATE outbox SET next_attempt_at = 0 WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()

    claimed = claim_pending()
    entry_id2 = claimed[0]["id"]

    # simulate a worker dying mid-drain: claimed but never resolved
    conn = _connect()
    conn.execute("UPDATE outbox SET claimed_at = 0 WHERE id = ?", (entry_id2,))
    conn.commit()
    conn.close()
    reclaimed = claim_pending()
    assert len(reclaimed) == 1 and reclaimed[0]["id"] == entry_id2  # stale claim recovered

    mark_delivered(entry_id2)
    assert pending_count() == 0

    os.remove(_DB_PATH)
    print("outbox self-check passed")


if __name__ == "__main__":
    _demo()
