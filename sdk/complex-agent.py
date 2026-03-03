# sdk/simple_tool_agent.py
import asyncio
import contextlib
import random
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
    def __init__(self, background_audio=None) -> None:
        self._background_audio = background_audio
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

    @contextlib.asynccontextmanager
    async def _tool_sound(self):
        """Plays typing sound during tool calls.
        
        Uses a deferred stop so the mixer has time to push audible audio
        even for instant tools (the mixer blocksize is 100ms, so stopping
        immediately would produce no sound at all).
        """
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

    # Create background audio first so agent can reference it
    # thinking_sound handles normal LLM replies at 50% probability
    # tool calls are handled separately via _tool_sound() at 100%
    background_audio = BackgroundAudioPlayer(
        thinking_sound=[AudioConfig(BuiltinAudioClip.KEYBOARD_TYPING, volume=0.5, probability=0)],
    )

    # Pass background_audio to agent so tool calls can play at 100%
    agent = SimpleToolAgent(background_audio=background_audio)

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

    await session.say(
        "H this is a test of a very long text to see if I can interrupt you and also if I can continue the conversation after the interruption.",
        allow_interruptions=GREETING_INTERRUPTION
    )

if __name__ == "__main__":
    agents.cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))