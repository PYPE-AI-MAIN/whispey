import os
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
)
from livekit.plugins import (
    sarvam,
    elevenlabs,
    silero,
    openai,
)
from whispey import LivekitObserve


load_dotenv()

ALLOW_INTERRUPTIONS = True

# Initialize Whispey
pype = LivekitObserve(
    agent_id="062a517c-f14a-4d97-b95b-081083a62376",
    apikey="pype_f8c1672185f9fc16b0e77c0c425858b2858fd75ecd5b0684b7c9c5229fbc7a42",
    enable_otel=True,
)


class SimpleToolAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""
            You are a professional female voice assistant for booking and reminders. You are calm, clear, and direct.

            LANGUAGE:
            - Detect the language the user is speaking — Hindi, English, or a mix (Hinglish).
            - Always reply in the same language the user used.
            - When speaking Hindi, always use feminine verb forms and self-references.

            RESPONSE STYLE:
            - Never start a response with filler acknowledgments like "Sure!", "Got it!", "Absolutely!".
            - Keep responses concise and natural — as if speaking on a phone call.
            - Don't end every response with "Is there anything else I can help you with?".

            TOOLS:
            - When users ask about weather, use the get_weather tool.
            - When users ask about time, use the get_current_time tool.
            - When users ask for a joke, use the tell_joke tool.
            - When users ask to flip a coin or make a decision, use the flip_coin tool.
            """,
        )

    @function_tool
    async def get_weather(self, context: RunContext, location: str) -> str:
        """Get weather information for a location."""
        temperatures = [22, 25, 28, 18, 30, 15, 35]
        conditions = ["sunny", "cloudy", "rainy", "partly cloudy", "stormy"]
        temp = random.choice(temperatures)
        condition = random.choice(conditions)
        return f"The weather in {location} is currently {condition} with a temperature of {temp}°C."

    @function_tool
    async def get_current_time(self, context: RunContext, timezone: str = "local") -> str:
        """Get the current time."""
        from datetime import datetime
        if timezone.lower() == "utc":
            current_time = datetime.utcnow().strftime("%H:%M:%S UTC")
        else:
            current_time = datetime.now().strftime("%H:%M:%S")
        return f"The current time is {current_time}."

    @function_tool
    async def tell_joke(self, context: RunContext) -> str:
        """Tell the user a random joke."""
        jokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "Why did the scarecrow win an award? Because he was outstanding in his field!",
            "I told my computer I needed a break. Now it won't stop sending me Kit-Kat ads.",
            "Why do programmers prefer dark mode? Because light attracts bugs!",
            "What do you call a fake noodle? An impasta!",
        ]
        return random.choice(jokes)

    @function_tool
    async def flip_coin(self, context: RunContext) -> str:
        """Flip a coin and return heads or tails."""
        result = random.choice(["Heads", "Tails"])
        return f"The coin landed on {result}!"


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    session = AgentSession(
        stt=sarvam.STT(model="saaras:v4"),
        llm=openai.LLM(
            # gemma4-e4b-mtp (not the plain gemma4:e4b-it-qat tag also on this box) --
            # see GEMMA-ENDPOINT.md (Ashish, verified 14 Sep 2026): the MTP/speculative
            # variant is ~2x the decode speed. reasoning_effort="none" is required or
            # every reply pays several seconds of silent "thinking" first (same doc).
            model=os.environ.get("LLM_MODEL", "gemma4-e4b-mtp"),
            base_url=os.environ["LLM_BASE_URL"],
            api_key=os.environ["LLM_API_KEY"],
            temperature=0.4,
            reasoning_effort="none",
        ),
        tts=elevenlabs.TTS(
            voice_id="MmQVkVZnQ0dUbfWzcW6f",
            base_url="https://api.in.residency.elevenlabs.io/v1",
        ),
        vad=silero.VAD.load(),
        allow_interruptions=ALLOW_INTERRUPTIONS,
    )

    session_id = pype.start_session(session, phone_number="+1234567890")

    async def whispey_observe_shutdown():
        await pype.export(session_id)

    ctx.add_shutdown_callback(whispey_observe_shutdown)

    await session.start(
        room=ctx.room,
        agent=SimpleToolAgent(),
        room_input_options=RoomInputOptions(),
    )

    await session.say(
        "नमस्ते! बताइए, क्या मदद चाहिए?",
        allow_interruptions=ALLOW_INTERRUPTIONS,
    )


if __name__ == "__main__":
    agents.cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
