# sdk/simple_tool_agent_langfuse_only.py
import asyncio
import base64
import os
import random
from dotenv import load_dotenv
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.util.types import AttributeValue

from livekit import agents
from livekit.agents import (
    Agent, 
    AgentSession, 
    JobContext, 
    RunContext,
    WorkerOptions,
    function_tool,
    RoomInputOptions,
    metrics
)
from livekit.agents.telemetry import set_tracer_provider
from livekit.agents.voice import MetricsCollectedEvent
from livekit.plugins import (
    openai,
    elevenlabs,
    silero,
    sarvam
)

load_dotenv()

def setup_langfuse(
    metadata: dict[str, AttributeValue] | None = None,
    *,
    host: str | None = None,
    public_key: str | None = None,
    secret_key: str | None = None,
) -> TracerProvider:
    """Set up Langfuse OTEL tracing"""
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    public_key = public_key or os.getenv("LANGFUSE_PUBLIC_KEY")
    secret_key = secret_key or os.getenv("LANGFUSE_SECRET_KEY") 
    host = host or os.getenv("LANGFUSE_HOST")

    if not public_key or not secret_key or not host:
        raise ValueError("LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_HOST must be set")

    langfuse_auth = base64.b64encode(f"{public_key}:{secret_key}".encode()).decode()
    os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = f"{host.rstrip('/')}/api/public/otel"
    os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {langfuse_auth}"

    trace_provider = TracerProvider()
    trace_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    set_tracer_provider(trace_provider, metadata=metadata)
    return trace_provider

class SimpleToolAgent(Agent):
    def __init__(self) -> None:
        super().__init__(instructions="""
        You are a helpful assistant that can look up weather information and get current time.
        
        When users ask about weather, use the get_weather tool.
        When users ask about time, use the get_current_time tool.
        
        Be friendly and conversational. If users ask for both weather and time, call both tools.
        """)

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
        
        # Simulate weather data
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
        
        from datetime import datetime
        
        if timezone.lower() == "utc":
            current_time = datetime.utcnow().strftime("%H:%M:%S UTC")
        else:
            current_time = datetime.now().strftime("%H:%M:%S")
        
        return f"The current time is {current_time}."

async def entrypoint(ctx: JobContext):
    # Set up Langfuse tracing FIRST - before session creation
    trace_provider = setup_langfuse(
        metadata={
            "langfuse.session.id": ctx.room.name,
            "agent.id": "simple-tool-agent",
            "environment": "development"
        }
    )
    
    # Add flush callback for proper cleanup
    async def flush_trace():
        trace_provider.force_flush()
    
    ctx.add_shutdown_callback(flush_trace)
    
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
    )
    
    # Set up metrics collection for Langfuse
    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)

    await session.start(
        room=ctx.room,
        agent=SimpleToolAgent(),
        room_input_options=RoomInputOptions(),
    )

    await session.generate_reply(
        instructions="Greet the user and let them know you can help with weather information and current time."
    )

if __name__ == "__main__":
    agents.cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))