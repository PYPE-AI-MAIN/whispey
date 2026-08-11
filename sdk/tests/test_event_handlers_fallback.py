"""
Unit tests for the STT/TTS/LLM fallback-event recording added to
CorrectedTranscriptCollector (sdk/whispey/event_handlers.py).

Run with: python3 -m unittest sdk.tests.test_event_handlers_fallback -v
(from the sdk/ directory, or point PYTHONPATH at sdk/).

No test framework is set up in this SDK yet, so these use stdlib unittest —
zero new dependencies to run.
"""
import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from whispey.event_handlers import CorrectedTranscriptCollector, ConversationTurn


class FakeItem:
    def __init__(self, role, text):
        self.role = role
        self.text_content = text


class FakeEvent:
    def __init__(self, item):
        self.item = item


class TestFallbackEventsField(unittest.TestCase):
    """ConversationTurn.fallback_events should default empty and only appear
    in to_dict() output when non-empty, matching the existing convention for
    tool_calls and other enhanced fields."""

    def test_defaults_to_empty_list(self):
        turn = ConversationTurn(turn_id="turn_1", timestamp=0)
        self.assertEqual(turn.fallback_events, [])

    def test_omitted_from_to_dict_when_empty(self):
        turn = ConversationTurn(turn_id="turn_1", timestamp=0)
        self.assertNotIn("fallback_events", turn.to_dict())

    def test_included_in_to_dict_when_present(self):
        turn = ConversationTurn(turn_id="turn_1", timestamp=0)
        turn.fallback_events.append({"provider_type": "STT", "event_type": "primary_failed"})
        self.assertIn("fallback_events", turn.to_dict())
        self.assertEqual(len(turn.to_dict()["fallback_events"]), 1)

    def test_each_turn_gets_its_own_list_not_a_shared_default(self):
        # dataclass field(default_factory=list) pitfall: a plain `= []` default
        # would make every ConversationTurn share the same list instance.
        turn_a = ConversationTurn(turn_id="turn_1", timestamp=0)
        turn_b = ConversationTurn(turn_id="turn_2", timestamp=0)
        turn_a.fallback_events.append({"provider_type": "STT"})
        self.assertEqual(turn_b.fallback_events, [])


class TestRecordFallbackEventMidTurn(unittest.TestCase):
    """The case that works today: a provider fails (or recovers) while a turn
    is already in progress, i.e. after the user's speech was transcribed."""

    def setUp(self):
        self.collector = CorrectedTranscriptCollector()

    def test_attaches_to_the_in_progress_turn(self):
        self.collector.on_conversation_item_added(FakeEvent(FakeItem("user", "hello")))
        self.collector.record_fallback_event({"provider_type": "LLM", "event_type": "primary_failed"})
        self.collector.record_fallback_event({"provider_type": "TTS", "event_type": "primary_failed"})
        self.assertEqual(len(self.collector.current_turn.fallback_events), 2)

    def test_events_survive_into_the_finalized_turn(self):
        self.collector.on_conversation_item_added(FakeEvent(FakeItem("user", "hello")))
        self.collector.record_fallback_event({"provider_type": "TTS", "event_type": "primary_failed"})
        self.collector.on_conversation_item_added(FakeEvent(FakeItem("assistant", "hi there")))
        self.assertEqual(len(self.collector.turns), 1)
        self.assertEqual(len(self.collector.turns[0].fallback_events), 1)

    def test_recovery_event_type_is_preserved_verbatim(self):
        self.collector.on_conversation_item_added(FakeEvent(FakeItem("user", "hello")))
        self.collector.record_fallback_event({
            "provider_type": "STT",
            "event_type": "provider_recovered",
            "provider_label": "Deepgram (nova-3, en-US)",
        })
        event = self.collector.current_turn.fallback_events[0]
        self.assertEqual(event["event_type"], "provider_recovered")

    def test_never_raises_even_with_malformed_event(self):
        self.collector.on_conversation_item_added(FakeEvent(FakeItem("user", "hello")))
        # Should not raise even if the caller passes something unexpected —
        # this is called from a best-effort SDK listener during a live call.
        try:
            self.collector.record_fallback_event(None)  # type: ignore[arg-type]
        except Exception as e:
            self.fail(f"record_fallback_event raised unexpectedly: {e}")


class TestRecordFallbackEventNoActiveTurn(unittest.TestCase):
    """Documents CURRENT behavior when no turn is active yet: the event is a
    no-op (silently dropped). This is the known gap discussed for STT
    failures between turns and TTS/LLM failures on a bot-initiated turn (e.g.
    the opening greeting) with no preceding user speech — there is no
    current_turn to attach to at the moment the provider failure fires.
    """

    def setUp(self):
        self.collector = CorrectedTranscriptCollector()

    def test_no_op_when_current_turn_is_none(self):
        self.assertIsNone(self.collector.current_turn)
        self.collector.record_fallback_event({"provider_type": "STT", "event_type": "primary_failed"})
        # Known gap: no turn is created, the event is dropped, and it is not
        # recoverable later even once the next turn does get created.
        self.assertIsNone(self.collector.current_turn)

    def test_event_is_not_retroactively_attached_to_the_next_turn(self):
        self.collector.record_fallback_event({"provider_type": "STT", "event_type": "primary_failed"})
        self.collector.on_conversation_item_added(FakeEvent(FakeItem("user", "my message")))
        self.collector.on_conversation_item_added(FakeEvent(FakeItem("assistant", "ok got it")))
        self.assertEqual(len(self.collector.turns), 1)
        self.assertEqual(self.collector.turns[0].fallback_events, [])


class TestFinalizeSessionFlushesLeftoverTurn(unittest.TestCase):

    def test_leftover_current_turn_is_flushed_into_turns(self):
        collector = CorrectedTranscriptCollector()
        collector.on_conversation_item_added(FakeEvent(FakeItem("user", "hello")))
        # No assistant reply ever arrives (e.g. call disconnects mid-turn) --
        # finalize_session() must not lose this turn.
        collector.finalize_session()
        self.assertEqual(len(collector.turns), 1)
        self.assertIsNone(collector.current_turn)


if __name__ == "__main__":
    unittest.main()
