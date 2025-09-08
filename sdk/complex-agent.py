# sdk/simple_tool_agent.py
import asyncio
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
    RoomInputOptions
)
from livekit.plugins import (
    openai,
    elevenlabs,
    silero,
    sarvam
)
from whispey import LivekitObserve


load_dotenv()

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
        # preemptive_generation=True,
    )
    
    # Set up observability after session creation
    session_id = pype.start_session(session, phone_number="+1234567890")

    # send session data to Whispey
    async def whispey_observe_shutdown():
          await pype.export(session_id)

    ctx.add_shutdown_callback(whispey_observe_shutdown)

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