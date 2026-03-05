# sdk/simple_tool_agent.py
import asyncio
import contextlib
import random
import time
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    WorkerOptions,
    function_tool,
    RoomInputOptions,
    BackgroundAudioPlayer,
    AudioConfig,
    BuiltinAudioClip,
)
from livekit.plugins import (
    openai,
    elevenlabs,
    silero,
    sarvam
)
from whispey import LivekitObserve


load_dotenv()

# Configuration
GREETING_INTERRUPTION = True
# SESSION_INTERRUPTION = False
SESSION_INTERRUPTION = True

# --- Filler word + dynamic typing sound config ---
# Probability (0.0–1.0) that typing sound plays for a normal LLM turn.
# Typing-sound turns are also used to measure real LLM latency for the EMA.
# Lower = more filler/silent turns; higher = more typing sound turns.
TYPING_PROBABILITY = 0.3

# Minimum seconds that must pass between two fillers being queued.
# Prevents rapid-fire fillers when:
#   - user speaks in quick successive bursts (each END_SPEECH triggers on_user_turn_completed)
#   - agent's own TTS audio triggers the VAD (echo), causing phantom short utterances
# During the cooldown, filler-path turns are simply silent instead.
FILLER_COOLDOWN_SEC = 4.0

# Only play a filler if estimated LLM+TTS latency exceeds this threshold (seconds).
# Below this, the LLM responds fast enough that a filler adds unnecessary delay.
# Above this, the gap is noticeable and a filler bridges it naturally.
FILLER_LATENCY_THRESHOLD = 1.2

# EMA smoothing factor for latency estimate updates (0 < α ≤ 1).
# Higher = adapts faster to changes; lower = more stable/averaged.
FILLER_LATENCY_ALPHA = 0.3

# Short filler phrases — keep these to 1–3 words so they finish before the LLM response.
# These are queued in on_user_turn_completed, which fires BEFORE the LLM speech handle
# is scheduled, guaranteeing fillers always play BEFORE the LLM response.
#
# Three sets based on turn classification:
#   QUESTION  — user clearly asked something (starts with what/who/where/why/how or ends with ?)
#   AMBIGUOUS — could be a question or not (starts with is/are/can/could/do/does/did/would/should)
#   GENERAL   — statement, command, or request
FILLER_WORDS_QUESTION = [
    "Sure.",
    "Of course.",
    "Let me think.",
    "One moment.",
    "Let me see.",
]

FILLER_WORDS_AMBIGUOUS = [
    "Of course.",
    "Sure.",
    "One moment.",
    "Right.",
    "Let me check.",
]

FILLER_WORDS_GENERAL = [
    "Sure.",
    "Of course.",
    "Got it.",
    "Absolutely.",
    "Right.",
]

# Question words that clearly signal the user is asking something.
_STRONG_QUESTION_STARTERS = {"what", "who", "where", "when", "why", "how"}
# Soft starters — grammatically questions but often ambiguous in voice context.
_SOFT_QUESTION_STARTERS = {"is", "are", "can", "could", "do", "does", "did", "would", "should", "will"}


def _classify_turn(text: str) -> str:
    """Classify user turn as 'question', 'ambiguous', or 'general'.

    Returns one of three string literals used to select the filler word pool.
    Uses lightweight heuristics only — no LLM call, zero added latency.
    """
    stripped = text.strip().rstrip(".,!").lower()
    first_word = stripped.split()[0] if stripped.split() else ""

    if text.strip().endswith("?") or first_word in _STRONG_QUESTION_STARTERS:
        return "question"
    if first_word in _SOFT_QUESTION_STARTERS:
        return "ambiguous"
    return "general"

# Initialize Whispey
pype = LivekitObserve(
    agent_id="062a517c-f14a-4d97-b95b-081083a62376", 
    apikey="pype_f8c1672185f9fc16b0e77c0c425858b2858fd75ecd5b0684b7c9c5229fbc7a42",
    bug_reports_enable=True, 
    bug_reports_config={
        "enable": True,
        "bug_start_command": ["feedback start"],
        "bug_end_command": ["feedback over"],
        "response": "Thanks for reporting that. Please tell me the issue?",
        "continuation_prefix": "So, as I was saying, ",
        "fallback_message": "So, as I was saying,",
        "collection_prompt": "",
        "debug":True,
    },
    enable_otel=True
)

class SimpleToolAgent(Agent):
    def __init__(self, background_audio=None, cleanup_ref: list | None = None) -> None:
        self._background_audio = background_audio
        self._in_tool_call: bool = False
        # Mutable ref so _tool_sound() can call the session-scoped _cleanup().
        # Defaults to a no-op until entrypoint sets cleanup_ref[0] = _cleanup.
        self._cleanup_ref: list = cleanup_ref if cleanup_ref is not None else [lambda: None]
        # Set True when probability roll chooses typing sound, False for filler/silent path.
        # Decided in on_user_turn_completed before LLM is called.
        self._use_typing_sound: bool = True
        # Handle for the queued filler speech so we can interrupt it if the
        # user speaks again before it plays.
        self._filler_handle: object | None = None
        # Timestamp of the last filler queued. Used to enforce FILLER_COOLDOWN_SEC
        # so rapid successive utterances or VAD echo don't pile up multiple fillers.
        self._last_filler_time: float = 0.0
        # Adaptive latency estimate (EMA) — seconds from turn-end to first LLM audio.
        # Starts just above the threshold so the very first turn may get a filler,
        # then self-calibrates quickly from typing-sound turns.
        # Updated only on typing-sound turns (filler turns inflate the measurement).
        self._est_llm_latency: float = 1.3
        # Monotonic timestamp set at the start of each turn. Used to measure
        # actual LLM latency when the agent transitions to SPEAKING.
        self._turn_start_time: float = 0.0
        # True only on typing-sound turns — gates latency measurement in the
        # state handler so filler-turn timings don't corrupt the EMA.
        self._measure_latency_this_turn: bool = False
        super().__init__(
            instructions="""
            You are a helpful assistant that can look up weather information, get current time, tell jokes, and flip a coin.
            
            When users ask about weather, use the get_weather tool.
            When users ask about time, use the get_current_time tool.
            When users ask for a joke, use the tell_joke tool.
            When users ask to flip a coin or make a decision, use the flip_coin tool.
            
            Be friendly and conversational. If users ask for both weather and time, call both tools.
            """,
        )

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        """Called when user finishes speaking, BEFORE the LLM speech handle is scheduled.

        This is the only hook where session.say() reliably queues BEFORE the LLM
        response — because the LLM speech handle isn't created until this method returns.
        Any session.say() call during the THINKING state handler is too late (LLM handle
        is already in the queue by then), which causes filler to play after the response.
        """
        # Interrupt any leftover filler from the previous turn that hasn't played yet.
        # This happens when the user speaks again quickly before the stale filler plays.
        if self._filler_handle is not None:
            handle = self._filler_handle
            self._filler_handle = None
            if not handle.done:  # type: ignore[union-attr]
                handle.interrupt()  # type: ignore[union-attr]

        if not self._in_tool_call:
            now = time.monotonic()
            within_cooldown = (now - self._last_filler_time) < FILLER_COOLDOWN_SEC

            # Record turn start so the state handler can measure real LLM latency.
            self._turn_start_time = now
            self._measure_latency_this_turn = False

            if random.random() < TYPING_PROBABILITY:
                # TYPING SOUND PATH — state handler plays typing on THINKING and
                # stops it on SPEAKING/LISTENING. Works for any LLM latency since
                # it runs exactly as long as the LLM takes. Also used to calibrate
                # the latency EMA (no filler present, so timing is clean).
                self._use_typing_sound = True
                self._measure_latency_this_turn = True

            elif within_cooldown:
                # SILENT PATH — cooldown active (rapid speech / VAD echo guard).
                # Skip filler to avoid stacking multiple fillers from a burst.
                self._use_typing_sound = False

            elif self._est_llm_latency > FILLER_LATENCY_THRESHOLD:
                # FILLER PATH — LLM is expected to take long enough that a filler
                # meaningfully bridges the gap. Queue exactly ONE filler word BEFORE
                # the LLM handle is scheduled (this is the only window where
                # session.say() reliably plays before the LLM response).
                self._use_typing_sound = False
                self._last_filler_time = now
                raw = getattr(new_message, "content", None)
                if isinstance(raw, str):
                    user_text = raw
                elif isinstance(raw, list):
                    # Multimodal content — extract text parts only.
                    user_text = " ".join(
                        item if isinstance(item, str) else getattr(item, "text", "")
                        for item in raw
                        if isinstance(item, str) or getattr(item, "text", "")
                    )
                else:
                    user_text = ""
                turn_type = _classify_turn(user_text)
                if turn_type == "question":
                    pool = FILLER_WORDS_QUESTION
                elif turn_type == "ambiguous":
                    pool = FILLER_WORDS_AMBIGUOUS
                else:
                    pool = FILLER_WORDS_GENERAL
                self._filler_handle = self.session.say(
                    random.choice(pool),
                    add_to_chat_ctx=False,  # don't pollute conversation history
                )

            else:
                # SILENT PATH — LLM estimated fast enough (≤ FILLER_LATENCY_THRESHOLD).
                # Playing a filler would add more delay than the LLM itself takes,
                # so let the response come through directly with no bridging audio.
                self._use_typing_sound = False

        await super().on_user_turn_completed(turn_ctx, new_message)

    @contextlib.asynccontextmanager
    async def _tool_sound(self):
        """Plays typing sound during tool calls.

        Sets _in_tool_call=True for the duration so the agent_state_changed
        handler skips its own probability/filler logic on subsequent THINKING
        events during tool execution.

        Also calls _cleanup() immediately on entry to stop any typing sound or
        pending filler the state handler may have started on the FIRST THINKING
        event (which fires before _in_tool_call is True) — this is the root
        cause of the double-audio bug on tool call turns.

        Uses a deferred stop so the mixer has time to push audible audio
        even for instant tools (the mixer blocksize is 100ms, so stopping
        immediately would produce no sound at all).
        """
        # Stop whatever the state handler started on the initial THINKING event.
        # Must happen BEFORE setting _in_tool_call so _cleanup() isn't a no-op
        # (the state handler guards its own output on _in_tool_call, but _cleanup
        # operates on handles/tasks directly with no such guard).
        self._cleanup_ref[0]()
        self._in_tool_call = True
        handle = None
        if self._background_audio:
            handle = self._background_audio.play(
                AudioConfig(BuiltinAudioClip.KEYBOARD_TYPING, volume=0.8),
                loop=True,
            )
            await asyncio.sleep(0)  # let _play_task start and add stream to mixer
        try:
            yield
        finally:
            self._in_tool_call = False
            # Prevent the state handler from starting a new typing sound on the
            # subsequent THINKING event (LLM processing the tool result).
            self._use_typing_sound = False
            if handle:
                async def _deferred_stop(h: object) -> None:
                    await asyncio.sleep(0.8)  # let mixer produce audible audio
                    h.stop()  # type: ignore[attr-defined]
                asyncio.create_task(_deferred_stop(handle))

    @function_tool
    async def get_weather(
        self,
        context: RunContext,
        location: str
    ) -> str:
        """
        Get weather information for a location.
        
        Args:
            location: The city or location to get weather for
        """
        async with self._tool_sound():
            temperatures = [22, 25, 28, 18, 30, 15, 35]
            conditions = ["sunny", "cloudy", "rainy", "partly cloudy", "stormy"]
            temp = random.choice(temperatures)
            condition = random.choice(conditions)
            return f"The weather in {location} is currently {condition} with a temperature of {temp}°C."

    @function_tool
    async def get_current_time(
        self,
        context: RunContext,
        timezone: str = "local"
    ) -> str:
        """
        Get the current time.
        
        Args:
            timezone: The timezone to get time for (local, UTC, etc.)
        """
        async with self._tool_sound():
            from datetime import datetime
            if timezone.lower() == "utc":
                current_time = datetime.utcnow().strftime("%H:%M:%S UTC")
            else:
                current_time = datetime.now().strftime("%H:%M:%S")
            return f"The current time is {current_time}."

    @function_tool
    async def tell_joke(
        self,
        context: RunContext,
    ) -> str:
        """Tell the user a random joke."""
        async with self._tool_sound():
            jokes = [
                "Why don't scientists trust atoms? Because they make up everything!",
                "Why did the scarecrow win an award? Because he was outstanding in his field!",
                "I told my computer I needed a break. Now it won't stop sending me Kit-Kat ads.",
                "Why do programmers prefer dark mode? Because light attracts bugs!",
                "What do you call a fake noodle? An impasta!",
            ]
            return random.choice(jokes)

    @function_tool
    async def flip_coin(
        self,
        context: RunContext,
    ) -> str:
        """Flip a coin and return heads or tails."""
        async with self._tool_sound():
            result = random.choice(["Heads", "Tails"])
            return f"The coin landed on {result}!"

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    
    session = AgentSession(
        stt=sarvam.STT(
            language="en-IN", 
            model="saarika:v2.5"
        ),                  
        llm=openai.LLM(
            model="gpt-4.1-mini",
            temperature=0.3
        ),                    
        tts=elevenlabs.TTS(
            voice_id="H8bdWZHK2OgZwTN7ponr",
            model="eleven_flash_v2_5",
            language="en", 
            voice_settings=elevenlabs.VoiceSettings(
                similarity_boost=1,
                stability=0.8,
                style=0.6,
                use_speaker_boost=False,
                speed=1.1
            )
        ),  
        vad=silero.VAD.load(),
        allow_interruptions=SESSION_INTERRUPTION,
        # min_interruption_duration=1,
        # preemptive_generation=True,
    )
    
    # Set up observability after session creation
    session_id = pype.start_session(session, phone_number="+1234567890")

    # send session data to Whispey
    async def whispey_observe_shutdown():
          await pype.export(session_id)

    ctx.add_shutdown_callback(whispey_observe_shutdown)

    # thinking_sound is fully disabled (probability=0) — filler words are
    # handled in on_user_turn_completed; typing sound is handled in the
    # agent_state_changed handler below.
    background_audio = BackgroundAudioPlayer(
        thinking_sound=[AudioConfig(BuiltinAudioClip.KEYBOARD_TYPING, volume=0.5, probability=0)],
    )

    # Mutable ref so _tool_sound() can reach _cleanup() before it's defined.
    _cleanup_ref: list = [lambda: None]
    agent = SimpleToolAgent(background_audio=background_audio, cleanup_ref=_cleanup_ref)

    await session.start(
        room=ctx.room,
        agent=agent,
        room_input_options=RoomInputOptions(),
    )

    # Must start AFTER session.start()
    await background_audio.start(room=ctx.room, agent_session=session)

    async def background_audio_shutdown():
        await background_audio.aclose()

    ctx.add_shutdown_callback(background_audio_shutdown)

    # ------------------------------------------------------------------
    # Dynamic typing sound system
    #
    # Filler words are queued in on_user_turn_completed (on the agent class)
    # because that hook fires BEFORE the LLM speech handle is scheduled.
    # session.say() during THINKING is already too late — the LLM handle is
    # already in the queue, so the filler ends up playing after the response.
    #
    # This handler only manages typing sound for sound-path turns.
    # All state scoped via nonlocal — no globals, no cross-session interference.
    # ------------------------------------------------------------------
    thinking_handle: object = None

    async def _deferred_stop_handle(h: object) -> None:
        """Stop a BackgroundAudioPlayer handle after a short tail delay.

        The mixer operates in ~100ms blocks. Stopping immediately produces
        no audible audio, so we wait 0.8s before stopping.
        """
        await asyncio.sleep(0.8)
        h.stop()  # type: ignore[attr-defined]

    def _cleanup() -> None:
        """Schedule deferred stop of the active typing sound handle.

        Safe to call from any state — no-op if already idle.
        """
        nonlocal thinking_handle

        if thinking_handle is not None:
            asyncio.create_task(_deferred_stop_handle(thinking_handle))
            thinking_handle = None

    # Wire cleanup ref so _tool_sound() can stop state-handler typing sound
    # on tool-call entry (prevents double audio on first THINKING event).
    _cleanup_ref[0] = _cleanup

    def on_agent_state_changed(ev) -> None:
        nonlocal thinking_handle

        if ev.new_state == "thinking":
            # Skip if inside a tool call — _tool_sound() owns audio there.
            # Skip if on_user_turn_completed chose the filler path.
            if agent._in_tool_call or not agent._use_typing_sound:
                return

            # Clean up any leftover handle from a previous turn.
            _cleanup()

            thinking_handle = background_audio.play(
                AudioConfig(BuiltinAudioClip.KEYBOARD_TYPING, volume=0.5),
                loop=True,
            )

        elif ev.new_state == "speaking":
            # LLM response starting — stop typing sound.
            # If this was a typing-sound turn, measure actual latency and update
            # the EMA so future filler decisions are calibrated to real conditions.
            # Only typing-sound turns are measured: filler turns inflate the time
            # by the filler's own duration, which would corrupt the estimate.
            if agent._measure_latency_this_turn and agent._turn_start_time > 0.0:
                elapsed = time.monotonic() - agent._turn_start_time
                agent._est_llm_latency = (
                    FILLER_LATENCY_ALPHA * elapsed
                    + (1 - FILLER_LATENCY_ALPHA) * agent._est_llm_latency
                )
                agent._measure_latency_this_turn = False
                agent._turn_start_time = 0.0
            _cleanup()

        elif ev.new_state == "listening":
            # User interrupted mid-think — stop typing sound.
            # Don't update latency EMA: interrupted turns don't reflect normal LLM time.
            agent._measure_latency_this_turn = False
            agent._turn_start_time = 0.0
            _cleanup()

    session.on("agent_state_changed", on_agent_state_changed)

    await session.say(
        "This is the dynamic typing test in this you have to check like filler words and typing sound mixing and typing in tool call always.",
        allow_interruptions=GREETING_INTERRUPTION
    )
 
if __name__ == "__main__":
    agents.cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

    