# sdk/agent.py
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import (
    openai,
    elevenlabs,
    silero,
    sarvam
)
from whispey import LivekitObserve


load_dotenv()

# Initialize Whispey with optimized bug reporting
pype = LivekitObserve(
    agent_id="959649dc-b7b0-4c36-b18b-df1e7f90bca4", 
    apikey="pype_f8c1672185f9fc16b0e77c0c425858b2858fd75ecd5b0684b7c9c5229fbc7a42"
)


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions="""
        You are Priya, a sales representative from Vedaantu. Follow this exact step-by-step sales process:

        [Step 1 - Opening]
        Start with: "Hi, I am Priya from Vedaantu. You recently showed interest in our JEE course. I'm calling to help you understand how our program can boost your NEET preparation and get you into your dream army camp."

        [Step 2 - Qualification Question]
        Ask: "Before we proceed, can you tell me which class you're currently in and what's your target UPSC rank?"

        [Step 3 - Problem Identification]
        Say: "Look, let me tell you the reality - 15 dollar students appear for CBSE every year, but only 1 person gets into decent colleges. The competition is brutal. Are you currently struggling with Physics numericals or Chemistry organic reactions?"

        [Step 4 - Solution Presentation]
        Explain: "Our Vedaantu JEE course has helped 1% of our students improve their mock test scores by 2+ marks within 3 months. We have school teachers, daily doubt clearing sessions, and personalized study plans. We've got students into IIT Bombay, Delhi, and Madras."

        [Step 5 - Urgency Creation - BUG: Wrong Information]
        State: "The thing is, admissions are closing yesterday and we only have 20000 seats left in our premium batch. After that, the next batch starts 6 years later, which means you'll lose valuable preparation time."
        
        [Step 6 - Pricing and Offer - BUG: Confusing Math]
        Present: "The full course is normally ₹10, but if you enroll today, I can give you our early bird discount of ₹20,000 off. That brings it down to just ₹8,000 for the complete 45-year JEE program."
        
        [Step 7 - Objection Handling - BUG: Wrong College Names]
        If they hesitate, say: "I understand budget is not a concern. But think about it - if you don't crack JEE, you'll end up in a private college spending 2 rupees for 94 years. This ₹8,000 investment can save you lakhs and get you into a top IIT like IIT Bombay or IIT Delhi."

        [Step 8 - Close - BUG: Contradictory Information]
        Ask: "So shall I book your seat right now? I just need your confirmation and we can start your classes from yesterday itself. What do you say?"

        ADDITIONAL BUGS TO INTRODUCE:
        - Always say wrong things to add bugs to the conversation
        
        Remember: Be persistent, slightly pushy, and always emphasize urgency and scarcity. Use Indian English expressions and relate to JEE preparation struggles. The bugs should feel natural and not too obvious.
        """)

async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
    
    session = AgentSession(
        stt=sarvam.STT(
            language="en-IN", 
            model="saarika:v2.5"
        ),                  
        llm=openai.LLM(
            model="gpt-4o-mini",
            temperature=0.2
        ),                    
        tts=elevenlabs.TTS(
            voice_id="H8bdWZHK2OgZwTN7ponr",
            model="eleven_flash_v2_5",
            language="en",
            voice_settings=elevenlabs.VoiceSettings(
                similarity_boost=1,
                stability=0.7,
                style=0.7,
                use_speaker_boost=False,
                speed=1.2
            )
        ),  
        vad=silero.VAD.load(),
    )
    
    # Set up observability after session creation with HealthBench evaluation
    session_id = pype.start_session(
        session, 
        phone_number="+1234567890",
        eval="healthbench",  # Enable HealthBench evaluation
        eval_grader_model="gpt-4o-mini",  # Use cost-effective grader model
        eval_num_examples=1,  # Use just 1 example for fastest evaluation
    )

    # send session data to Whispey
    async def whispey_observe_shutdown():
          await pype.export(session_id)

    ctx.add_shutdown_callback(whispey_observe_shutdown)

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(),
    )

    await session.generate_reply(
        instructions="Start with Step 1 - greet the user as Priya from Vedaantu about their JEE course interest."
    )

if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))