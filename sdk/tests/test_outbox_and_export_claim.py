"""
Unit tests for the local-disk outbox + atomic export claim added to fix:
  - data loss when a process dies before a call's data reaches Whispey
  - duplicate sends when multiple call paths (EOD/end_call/transfer/shutdown)
    all try to export the same call
  - outbox entries stuck forever if a worker dies mid-drain
  - outbox retries not happening on a day with zero new calls

Run with: python3 -m unittest discover -s sdk/tests -v
(from the repo root, or point PYTHONPATH at sdk/).

stdlib unittest only, matching test_event_handlers_fallback.py's convention.
"""
import sys
import os
import time
import asyncio
import sqlite3
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from whispey import outbox
from whispey.delivery_worker import drain_outbox
from whispey import whispey as whispey_module


class TestOutbox(unittest.TestCase):
    """outbox.py: write -> claim -> deliver/fail, backoff, stale-claim recovery, dead-letter."""

    def setUp(self):
        self._orig_db_path = outbox._DB_PATH
        outbox._DB_PATH = f"/tmp/whispey_outbox_test_{time.time_ns()}.db"

    def tearDown(self):
        if os.path.exists(outbox._DB_PATH):
            os.remove(outbox._DB_PATH)
        outbox._DB_PATH = self._orig_db_path

    def test_write_then_claim_returns_entry(self):
        entry_id = outbox.write_entry("call_1", "call_ended", {"a": 1})
        claimed = outbox.claim_pending()
        self.assertEqual(len(claimed), 1)
        self.assertEqual(claimed[0]["id"], entry_id)
        self.assertEqual(claimed[0]["payload"], {"a": 1})

    def test_double_claim_while_in_progress_returns_nothing(self):
        outbox.write_entry("call_1", "call_ended", {})
        outbox.claim_pending()
        self.assertEqual(outbox.claim_pending(), [])

    def test_failed_entry_backs_off_before_retry(self):
        entry_id = outbox.write_entry("call_1", "call_ended", {})
        outbox.claim_pending()
        outbox.mark_failed(entry_id, "network error")
        # back to pending, but backoff hasn't elapsed yet
        self.assertEqual(outbox.pending_count(), 1)
        self.assertEqual(outbox.claim_pending(), [])

    def test_stale_in_progress_claim_is_recovered(self):
        entry_id = outbox.write_entry("call_1", "call_ended", {})
        outbox.claim_pending()  # now in_progress, claimed_at = now

        conn = outbox._connect()
        conn.execute("UPDATE outbox SET claimed_at = 0 WHERE id = ?", (entry_id,))
        conn.commit()
        conn.close()

        reclaimed = outbox.claim_pending()
        self.assertEqual(len(reclaimed), 1)
        self.assertEqual(reclaimed[0]["id"], entry_id)

    def test_dead_lettered_after_max_attempts(self):
        entry_id = outbox.write_entry("call_1", "call_ended", {})
        for _ in range(outbox._MAX_ATTEMPTS):
            outbox.claim_pending()
            outbox.mark_failed(entry_id, "still failing")
            conn = outbox._connect()
            conn.execute("UPDATE outbox SET next_attempt_at = 0 WHERE id = ?", (entry_id,))
            conn.commit()
            conn.close()

        conn = outbox._connect()
        status = conn.execute("SELECT status FROM outbox WHERE id = ?", (entry_id,)).fetchone()[0]
        conn.close()
        self.assertEqual(status, "dead")
        # dead entries are excluded from the retry queue and from pending_count
        self.assertEqual(outbox.claim_pending(), [])
        self.assertEqual(outbox.pending_count(), 0)

    def test_mark_delivered_removes_entry(self):
        entry_id = outbox.write_entry("call_1", "call_ended", {})
        outbox.claim_pending()
        outbox.mark_delivered(entry_id)
        self.assertEqual(outbox.pending_count(), 0)

    def test_write_survives_close_failure_after_commit(self):
        """A conn.close() failure right after a successful commit must not
        make write_entry() look like it failed — the row is already durably
        on disk; raising here would make the caller wrongly re-send via a
        fallback path, on top of the already-committed row. Regression test
        for the _safe_close() fix."""
        import unittest.mock as mock
        real_connect = sqlite3.connect

        class FlakyCloseConn:
            def __init__(self, real_conn):
                self._real = real_conn
            def __getattr__(self, name):
                return getattr(self._real, name)
            def close(self):
                raise sqlite3.OperationalError("close failed, but data is already committed")

        def flaky_connect(*a, **k):
            return FlakyCloseConn(real_connect(*a, **k))

        with mock.patch("sqlite3.connect", side_effect=flaky_connect):
            entry_id = outbox.write_entry("call_1", "call_ended", {"a": 1})

        self.assertIsNotNone(entry_id)
        # the row really is there despite close() having "failed"
        self.assertEqual(outbox.pending_count(), 1)


class TestDeliveryWorker(unittest.IsolatedAsyncioTestCase):
    """delivery_worker.drain_outbox(): drains claimed entries via send_fn, routes success/failure."""

    def setUp(self):
        self._orig_db_path = outbox._DB_PATH
        outbox._DB_PATH = f"/tmp/whispey_outbox_test_{time.time_ns()}.db"

    def tearDown(self):
        if os.path.exists(outbox._DB_PATH):
            os.remove(outbox._DB_PATH)
        outbox._DB_PATH = self._orig_db_path

    async def test_successful_send_removes_entry(self):
        outbox.write_entry("call_1", "call_ended", {"whispey_data": {}, "apikey": "k", "api_url": "u"})

        async def fake_send(data, apikey=None, api_url=None):
            return {"success": True}

        sent, failed = await drain_outbox(send_fn=fake_send)
        self.assertEqual((sent, failed), (1, 0))
        self.assertEqual(outbox.pending_count(), 0)

    async def test_failed_send_keeps_entry_for_retry(self):
        outbox.write_entry("call_1", "call_ended", {"whispey_data": {}, "apikey": "k", "api_url": "u"})

        async def fake_send(data, apikey=None, api_url=None):
            return {"success": False, "error": "boom"}

        sent, failed = await drain_outbox(send_fn=fake_send)
        self.assertEqual((sent, failed), (0, 1))
        self.assertEqual(outbox.pending_count(), 1)  # still there, backing off

    async def test_send_fn_exception_is_caught_and_marks_failed(self):
        outbox.write_entry("call_1", "call_ended", {"whispey_data": {}, "apikey": "k", "api_url": "u"})

        async def raising_send(data, apikey=None, api_url=None):
            raise RuntimeError("network down")

        sent, failed = await drain_outbox(send_fn=raising_send)
        self.assertEqual((sent, failed), (0, 1))
        self.assertEqual(outbox.pending_count(), 1)

    async def test_claim_pending_error_does_not_raise(self):
        # simulate a broken outbox file: claim_pending() will throw a
        # sqlite error. drain_outbox() must not propagate it — a startup
        # sweep runs fire-and-forget and must never crash the caller.
        outbox._DB_PATH = "/nonexistent-dir/definitely/not/writable.db"
        sent, failed = await drain_outbox(send_fn=lambda *a, **k: None)
        self.assertEqual((sent, failed), (0, 0))


class TestExportClaim(unittest.IsolatedAsyncioTestCase):
    """whispey.py send_session_to_whispey(): single-writer claim + outbox-before-send."""

    def setUp(self):
        self.session_id = "sess_1"
        whispey_module._session_data_store[self.session_id] = {
            "call_active": True,
            "apikey": "k",
            "api_url": "u",
        }

        self._orig = {
            name: getattr(whispey_module, name)
            for name in (
                "get_session_whispey_data",
                "structure_telemetry_data",
                "end_session_manually",
                "cleanup_session",
                "send_to_whispey",
                "outbox_write",
                "outbox_delivered",
                "outbox_failed",
            )
        }
        whispey_module.get_session_whispey_data = lambda sid: {"session_id": sid}
        whispey_module.structure_telemetry_data = lambda sid: {}
        whispey_module.end_session_manually = lambda *a, **k: None
        whispey_module.cleanup_session = lambda sid: whispey_module._session_data_store.pop(sid, None)

        self.send_calls = []

        async def fake_send(data, apikey=None, api_url=None):
            self.send_calls.append(data)
            return {"success": True}

        whispey_module.send_to_whispey = fake_send
        whispey_module.outbox_write = lambda call_id, event_type, payload: 1
        whispey_module.outbox_delivered = lambda entry_id: None
        whispey_module.outbox_failed = lambda entry_id, error: None

    def tearDown(self):
        whispey_module._session_data_store.pop(self.session_id, None)
        for name, fn in self._orig.items():
            setattr(whispey_module, name, fn)

    async def test_first_call_sends_second_call_skips(self):
        whispey_module._session_data_store[self.session_id]["call_active"] = True
        first = await whispey_module.send_session_to_whispey(self.session_id)
        self.assertTrue(first.get("success"))
        self.assertNotIn("skipped", first)
        self.assertEqual(len(self.send_calls), 1)

        # session was cleaned up after success — simulate a second trigger
        # path racing in with its own leftover reference to the session dict
        # (this is what _export_claimed is actually guarding against: the
        # dict entry existing but already claimed, not a missing session).
        whispey_module._session_data_store[self.session_id] = {
            "call_active": True, "apikey": "k", "api_url": "u", "_export_claimed": True,
        }
        second = await whispey_module.send_session_to_whispey(self.session_id)
        self.assertEqual(second, {"success": True, "skipped": True})
        self.assertEqual(len(self.send_calls), 1)  # still just the one real send

    async def test_outbox_write_failure_falls_back_to_direct_send(self):
        def raising_write(*a, **k):
            raise OSError("disk full")
        whispey_module.outbox_write = raising_write

        result = await whispey_module.send_session_to_whispey(self.session_id)
        self.assertTrue(result.get("success"))
        self.assertEqual(len(self.send_calls), 1)  # fell back to a direct send
        # success cleans up the session — nothing left to leak or re-claim
        self.assertNotIn(self.session_id, whispey_module._session_data_store)

    async def test_outbox_write_and_direct_send_both_failing_clears_claim(self):
        def raising_write(*a, **k):
            raise OSError("disk full")
        async def raising_send(data, apikey=None, api_url=None):
            raise ConnectionError("network unreachable")
        whispey_module.outbox_write = raising_write
        whispey_module.send_to_whispey = raising_send

        result = await whispey_module.send_session_to_whispey(self.session_id)
        self.assertFalse(result.get("success"))
        # claim must be released — otherwise this call could never be retried
        self.assertFalse(whispey_module._session_data_store[self.session_id]["_export_claimed"])

    async def test_send_failure_keeps_claim_so_outbox_owns_retry(self):
        async def failing_send(data, apikey=None, api_url=None):
            return {"success": False, "error": "5xx"}
        whispey_module.send_to_whispey = failing_send

        result = await whispey_module.send_session_to_whispey(self.session_id)
        self.assertFalse(result.get("success"))
        self.assertTrue(whispey_module._session_data_store[self.session_id]["_export_claimed"])


if __name__ == "__main__":
    unittest.main()
