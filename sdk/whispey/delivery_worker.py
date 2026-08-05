"""Drains the local outbox and delivers entries to Whispey.

Independent of any specific call's process — safe to run from a fresh
process on startup (sweeps up anything a prior process left behind), or
from a periodic scheduled job.
"""

import logging

from whispey.outbox import claim_pending, mark_delivered, mark_failed
from whispey.send_log import send_to_whispey

logger = logging.getLogger("whispey_outbox")


async def drain_outbox(limit: int = 10, send_fn=send_to_whispey):
    """Claim up to `limit` pending entries and attempt delivery. Returns (sent, failed) counts."""
    try:
        entries = claim_pending(limit=limit)
    except Exception as e:
        logger.error(f"[OUTBOX] claim_pending failed, skipping this drain: {e}")
        return 0, 0
    if not entries:
        return 0, 0

    sent, failed = 0, 0
    for entry in entries:
        entry_id = entry["id"]
        call_id = entry["call_id"]
        body = entry["payload"]
        try:
            result = await send_fn(
                body["whispey_data"],
                apikey=body.get("apikey"),
                api_url=body.get("api_url"),
            )
            if result.get("success"):
                mark_delivered(entry_id)
                sent += 1
            else:
                mark_failed(entry_id, str(result))
                failed += 1
        except Exception as e:
            logger.error(f"[OUTBOX] delivery worker error for call_id={call_id} id={entry_id}: {e}")
            mark_failed(entry_id, str(e))
            failed += 1

    logger.info(f"[OUTBOX] drain complete: sent={sent} failed={failed}")
    return sent, failed


async def _demo():
    import os
    from whispey import outbox as outbox_module

    outbox_module._DB_PATH = "/tmp/whispey_delivery_demo.db"
    if os.path.exists(outbox_module._DB_PATH):
        os.remove(outbox_module._DB_PATH)

    outbox_module.write_entry("call_1", "call_ended", {
        "whispey_data": {"call_id": "call_1"}, "apikey": "k", "api_url": "u",
    })

    async def fake_send(data, apikey=None, api_url=None):
        assert data["call_id"] == "call_1"
        assert apikey == "k" and api_url == "u"
        return {"success": True}

    sent, failed = await drain_outbox(send_fn=fake_send)
    assert sent == 1 and failed == 0
    assert outbox_module.pending_count() == 0

    os.remove(outbox_module._DB_PATH)
    print("delivery_worker self-check passed")


if __name__ == "__main__":
    import asyncio
    asyncio.run(_demo())
