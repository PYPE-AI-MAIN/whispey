from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    AgentSession, 
    Agent, 
    RoomInputOptions,
    llm,
    JobContext,
    function_tool
)
from livekit.plugins import (
    openai,
    cartesia,
    deepgram,
    silero,
    elevenlabs,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from whispey import LivekitObserve
from datetime import datetime
import asyncio
import json

load_dotenv()

pype = LivekitObserve(agent_id="5551677a-567b-41ec-8bdb-289408612968")

class HospitalAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful AI assistant for स्पर्श Hospital.
            
            You can help with:
            - Checking doctor availability
            - Getting hospital information
            - Simple appointment inquiries
            - General hospital queries
            
            Always be polite and helpful. If you cannot help with something,
            direct them to contact reception at +918448170041."""
        )

    @function_tool()
    async def get_current_time(self) -> str:
        """Get the current date and time"""
        now = datetime.now()
        return f"Current time: {now.strftime('%Y-%m-%d %H:%M:%S')}"

    @function_tool()
    async def get_hospital_info(self) -> str:
        """Get basic hospital information"""
        return """स्पर्श Hospital Information:
        
🏥 Name: स्पर्श Hospital Yeshwanthpur
📍 Location: Bangalore, Karnataka
📞 Contact: +918448170041
⏰ Working Hours: Monday to Saturday, 8:00 AM - 8:00 PM
🚫 Closed: Sundays

Specialties Available:
• General Medicine
• Cardiology  
• Orthopedics
• Gastroenterology
• Neurology
• ENT
• Ophthalmology
• And many more...

How can I help you today?"""

    @function_tool()
    async def check_doctor_availability_simple(self, doctor_name: str, day: str = "today") -> str:
        """Check if a doctor is available (simple version)"""
        # This is a simple mock - replace with actual API call
        await asyncio.sleep(0.5)  # Simulate API call
        
        if "kumar" in doctor_name.lower():
            return f"✅ Doctor {doctor_name} is available on {day}.\nSlots: 9:00 AM, 11:30 AM, 2:00 PM, 4:30 PM"
        elif "sharma" in doctor_name.lower():
            return f"✅ Doctor {doctor_name} is available on {day}.\nSlots: 10:00 AM, 12:00 PM, 3:00 PM"
        else:
            return f"❌ Doctor {doctor_name} is not available on {day}.\nWould you like me to suggest alternative doctors?"

    @function_tool()
    async def book_appointment_simple(self, patient_name: str, doctor_name: str, time_slot: str, mobile: str) -> str:
        """Book a simple appointment (demo version)"""
        # This is a demo function - replace with actual booking logic
        await asyncio.sleep(1.0)  # Simulate booking process
        
        appointment_id = f"APT{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        return f"""🎉 Appointment Booked Successfully!

📋 Details:
• Appointment ID: {appointment_id}
• Patient: {patient_name}
• Doctor: {doctor_name}
• Time: {time_slot}
• Mobile: {mobile}
• Hospital: स्पर्श Hospital

Please arrive 15 minutes early with a valid ID.
For changes, call +918448170041."""

    @function_tool()
    async def get_available_doctors(self, specialty: str = "all") -> str:
        """Get list of available doctors by specialty"""
        # Mock data - replace with actual API call
        doctors_by_specialty = {
            "cardiology": ["Dr. Raj Kumar", "Dr. Priya Sharma"],
            "orthopedics": ["Dr. Vinay Singh", "Dr. Meera Patel"],
            "general": ["Dr. Suresh Kumar", "Dr. Anjali Verma"],
            "gastroenterology": ["Dr. Amit Gupta", "Dr. Kavya Reddy"]
        }
        
        if specialty.lower() == "all":
            all_doctors = []
            for spec, docs in doctors_by_specialty.items():
                all_doctors.extend([f"{doc} ({spec.title()})" for doc in docs])
            return f"Available Doctors:\n" + "\n".join([f"• {doc}" for doc in all_doctors])
        
        specialty_lower = specialty.lower()
        if specialty_lower in doctors_by_specialty:
            doctors = doctors_by_specialty[specialty_lower]
            return f"{specialty.title()} Doctors:\n" + "\n".join([f"• {doc}" for doc in doctors])
        
        return f"❌ No doctors found for specialty: {specialty}\nAvailable specialties: {', '.join(doctors_by_specialty.keys())}"

    @function_tool()
    async def cancel_appointment(self, appointment_id: str, reason: str = "Patient request") -> str:
        """Cancel an existing appointment"""
        # Mock cancellation - replace with actual API call
        await asyncio.sleep(0.5)
        
        return f"""✅ Appointment Cancelled Successfully!

📋 Details:
• Appointment ID: {appointment_id}
• Cancellation Reason: {reason}
• Cancelled At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

If you need to book a new appointment, please let me know.
For urgent medical needs, call +918448170041."""

    @function_tool()
    async def get_patient_appointments(self, mobile_number: str) -> str:
        """Get patient's upcoming appointments"""
        # Mock data - replace with actual API call
        await asyncio.sleep(0.5)
        
        return f"""📅 Upcoming Appointments for {mobile_number}:

1. Dr. Raj Kumar (Cardiology)
   Date: August 15, 2025
   Time: 10:30 AM - 10:45 AM
   Status: Confirmed
   
2. Dr. Priya Sharma (General Medicine)
   Date: August 20, 2025
   Time: 2:00 PM - 2:15 PM
   Status: Pending

For changes, call +918448170041."""

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    
    # Initialize phone number as None - will be populated later if available
    phone_number = None
    
    # Create session with latest LiveKit configuration
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-2",
            language="en-IN",  # Indian English for better accent recognition
            smart_format=True,
            interim_results=True
        ),
        llm=openai.LLM(
            model="gpt-4o-mini",
            temperature=0.3,  # Lower temperature for more consistent responses
        ),
        tts=elevenlabs.TTS(
            voice_id="H8bdWZHK2OgZwTN7ponr",
            model="eleven_flash_v2_5",
            language="en",  # Use English for better clarity
            voice_settings=elevenlabs.VoiceSettings(
                similarity_boost=0.8,
                stability=0.7,
                style=0.6,
                use_speaker_boost=True,
                speed=1.0  # Normal speed for better understanding
            )
        ),
        vad=silero.VAD.load(
            # Configure VAD for better voice detection
            min_speech_duration=0.1,
            min_silence_duration=0.5,
        ),
        turn_detection=MultilingualModel(),
    )
    
    # Set up observability after session creation
    session_id = pype.start_session(session, phone_number=phone_number or "+1234567890")

    # Send session data to Whispey
    async def whispey_observe_shutdown():
        await pype.export(session_id, save_telemetry_json=True)

    ctx.add_shutdown_callback(whispey_observe_shutdown)

    # Start the session with the hospital assistant
    await session.start(
        room=ctx.room,
        agent=HospitalAssistant(),
        room_input_options=RoomInputOptions(),
    )

    # Extract phone number AFTER session starts and room is properly initialized
    try:
        if hasattr(ctx.room, 'participants') and ctx.room.participants:
            for participant in ctx.room.participants.values():
                if hasattr(participant, 'identity') and participant.identity.startswith('sip_+'):
                    phone_number = participant.identity.replace('sip_', '')
                    break
    except Exception as e:
        print(f"Could not extract phone number: {e}")
        # Continue without phone number

    # Generate initial greeting
    greeting_instructions = f"""Greet the caller warmly in English and introduce yourself as the AI assistant for स्पर्श Hospital.
    
    Say something like:
    "नमस्ते! This is स्पर्श Hospital. I'm your AI assistant. How can I help you today?"
    
    Current time: {datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')}
    Caller phone: {phone_number or 'Unknown'}
    
    Be ready to help with:
    - Doctor availability checks
    - Hospital information  
    - Simple appointment inquiries
    - General questions
    """
    
    await session.generate_reply(instructions=greeting_instructions)

if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            # Configure worker options for production
            load_threshold=0.8,
        )
    )