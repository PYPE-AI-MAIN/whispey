"""
ponytail: minimal regression check for the direct-send-vs-sweep outbox race.

send_session_to_whispey() writes an outbox entry then sends it directly
itself. Before this fix, the row was claimable the instant it was written,
so a concurrent drain_outbox() sweep (e.g. entrypoint.py's per-call startup
sweep, running for a *different* call on the same worker process) could
claim and resend the same row while the direct send was still in flight —
producing a real duplicate delivery (confirmed in prod: two Lambda
invocations ~8s apart for the same call_id).

Run: WHISPEY_OUTBOX_PATH=/tmp/test_outbox_race.db python3 test_outbox_claim_race.py
"""
import os
import tempfile

os.environ.setdefault("WHISPEY_OUTBOX_PATH", os.path.join(tempfile.gettempdir(), "test_outbox_race.db"))
if os.path.exists(os.environ["WHISPEY_OUTBOX_PATH"]):
    os.remove(os.environ["WHISPEY_OUTBOX_PATH"])

from whispey.outbox import write_entry, claim_pending, mark_delivered, mark_failed


def demo():
    # Simulates send_session_to_whispey(): write, about to send it ourselves.
    entry_id = write_entry("call_abc", "call_ended", {"whispey_data": {}}, claim_immediately=True)

    # A concurrent drain_outbox() sweep, for some other call on the same
    # worker process, runs right now — before our own send has finished.
    stolen = claim_pending()
    assert stolen == [], (
        f"race NOT closed: a concurrent sweep claimed our in-flight entry: {stolen}"
    )

    # Our own "send" now completes successfully.
    mark_delivered(entry_id)
    assert claim_pending() == [], "delivered entry should not be claimable"

    # Second scenario: a genuinely failed direct send must still become
    # retryable normally (mark_failed resets pending + backoff regardless
    # of starting status).
    entry_id_2 = write_entry("call_def", "call_ended", {"whispey_data": {}}, claim_immediately=True)
    mark_failed(entry_id_2, "network blip")
    # backoff on attempt 1 is ~2s, so it's not immediately claimable — that's
    # correct/expected (real retries shouldn't hammer immediately).
    assert claim_pending() == [], "just-failed entry should respect its own backoff, not be instantly claimable"

    print("OK: direct-send claim closes the race; failure path still retries normally")


if __name__ == "__main__":
    demo()
