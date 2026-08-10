"""Regression tests for outbox claim_immediately + cancellation handling.

Covers the two real incidents this logic exists to prevent:
1. Without claim_immediately, a row is claimable the instant it's written,
   so a concurrent drain_outbox() sweep for a *different* call on the same
   worker process can steal and resend it while the owner's own direct send
   is still in flight -> duplicate delivery (the original double-transcript
   bug).
2. claim_immediately alone isn't enough: if the send gets cancelled
   (asyncio.CancelledError, e.g. during shutdown), the claim must be
   released right away -- not left stuck for the full stale-claim window
   (or forever, on a one-job-per-process worker). Missing this is what
   made a prior version of this fix ship a regression (call_ended stopped
   arriving for most calls).

Run directly: python3 sdk/whispey/test_outbox_claim_race.py
"""
import os
import time

from whispey import outbox


def test_claim_immediately_blocks_concurrent_sweep():
    outbox._DB_PATH = "/tmp/whispey_outbox_test_race.db"
    if os.path.exists(outbox._DB_PATH):
        os.remove(outbox._DB_PATH)

    entry_id = outbox.write_entry("call_1", "call_ended", {"x": 1}, claim_immediately=True)

    # A concurrent sweep must find nothing claimable -- the row is already
    # 'in_progress', not 'pending'.
    assert outbox.claim_pending() == [], "claim_immediately failed to prevent concurrent claim"

    # Owner's send fails -> release the claim -> now retryable.
    outbox.mark_failed(entry_id, "simulated failure")
    conn = outbox._connect()
    conn.execute("UPDATE outbox SET next_attempt_at = 0 WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()
    claimed = outbox.claim_pending()
    assert len(claimed) == 1 and claimed[0]["id"] == entry_id, "released claim was not retryable"

    os.remove(outbox._DB_PATH)
    print("test_claim_immediately_blocks_concurrent_sweep passed")


def test_cancellation_releases_claim_immediately():
    outbox._DB_PATH = "/tmp/whispey_outbox_test_cancel.db"
    if os.path.exists(outbox._DB_PATH):
        os.remove(outbox._DB_PATH)

    entry_id = outbox.write_entry("call_2", "call_ended", {"x": 2}, claim_immediately=True)

    # Simulate whispey.py's `except asyncio.CancelledError` branch: release
    # the claim instead of leaving it stuck in_progress.
    outbox.mark_failed(entry_id, "cancelled during send")

    conn = outbox._connect()
    row = conn.execute("SELECT status, next_attempt_at FROM outbox WHERE id = ?", (entry_id,)).fetchone()
    conn.close()
    assert row is not None, "row disappeared"
    status, next_attempt_at = row
    assert status == "pending", f"expected 'pending' after release, got {status!r}"
    # Must be retryable on the normal short backoff, not stuck for the
    # ~300s stale-claim window -- that gap is exactly what made the prior
    # fix a regression (rows sat unclaimable until a rare later sweep).
    assert next_attempt_at - time.time() < 60, (
        "released claim's retry delay is suspiciously long -- looks like it "
        "fell through to the stale-claim window instead of a normal backoff"
    )

    os.remove(outbox._DB_PATH)
    print("test_cancellation_releases_claim_immediately passed")


if __name__ == "__main__":
    test_claim_immediately_blocks_concurrent_sweep()
    test_cancellation_releases_claim_immediately()
    print("all outbox claim-race regression tests passed")
