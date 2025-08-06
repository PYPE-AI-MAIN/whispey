# Whispey SDK

**Professional Voice Analytics for AI Agents**

Monitor, analyze, and gain insights from your AI voice agent conversations with Whispey's advanced voice analytics platform.

## 🚀 Quick Start

### Installation

```bash
pip install whispey
```

**📦 Available on PyPI:** [https://pypi.org/project/Whispey/1.4.0/](https://pypi.org/project/Whispey/1.4.0/)

### Get Your Credentials

1. **Sign up** at [Whispey Voice Analytics Dashboard](https://pype-voice-analytics-dashboard.vercel.app/)
2. **Get your Agent ID** from the dashboard
3. **Generate your API Key** from your account 

### Environment Setup

Create a `.env` file in your project root:

```env
# Whispey Voice Analytics
WHISPEY_API_KEY=your_whispey_api_key_here
```

## 📖 Complete Implementation

Here's a complete example of how to integrate Whispey into your LiveKit voice agent:

```python
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import (
    openai,
    deepgram,
    noise_cancellation,
    silero,
    elevenlabs,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from whispey import LivekitObserve

import base64
import os

# Load environment variables
load_dotenv()

# 🎙️ Initialize Whispey with your Agent ID from the dashboard
whispey = LivekitObserve(
    agent_id="your-agent-id-from-dashboard"  # Get this from https://pype-voice-analytics-dashboard.vercel.app/
)

class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions="You are a helpful voice AI assistant.")

async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
        
    # Configure your AI agent session
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=elevenlabs.TTS(
            voice_id="H8bdWZHK2OgZwTN7ponr",
            model="eleven_flash_v2_5",
            language="hi",  # Adjust language as needed
            voice_settings=elevenlabs.VoiceSettings(
                similarity_boost=1,
                stability=0.7,
                style=0.7,
                use_speaker_boost=False,
                speed=1.1
            )
        ),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )
    
    # 🚀 Start Whispey Voice Analytics
session_id = whispey.start_session(
    session,
    phone_number="+1234567890",     # Optional: Customer phone number
    customer_name="John Doe",       # Optional: Customer name
    conversation_type="voice_call"  # Optional: Type of conversation
)
    
    print(f"🎙️ Whispey Analytics started for session: {session_id}")

    # 📤 Export analytics data when session ends
    async def whispey_shutdown():
    try:
        result = await whispey.export(
            session_id,
            recording_url=""  # Optional: Add recording URL if available
        )
            
            if result.get("success"):
                print("✅ Successfully exported to Whispey Voice Analytics!")
                print(f"📊 Log ID: {result.get('data', {}).get('log_id')}")
            else:
                print(f"❌ Export failed: {result.get('error')}")
                
        except Exception as e:
            print(f"💥 Export error: {e}")

    # Register cleanup callback
    ctx.add_shutdown_callback(whispey_shutdown)

    # Start the agent session
    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(), 
        ),
    )

    # Generate initial greeting
    await session.generate_reply(
        instructions="Greet the user and offer your assistance."
    )

if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
```

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `WHISPEY_API_KEY` | Your Whispey API authentication key | [Dashboard → API Keys](https://pype-voice-analytics-dashboard.vercel.app/) |

### Agent Configuration

Replace `"your-agent-id-from-dashboard"` with your actual Agent ID from the Whispey dashboard:

```python
whispey = LivekitObserve(
    agent_id="2a72948a-094d-4a13-baf7-e033a5cdeb22"  # Your actual Agent ID
)
```

## 📊 Features

### Automatic Metrics Collection
- **🎙️ Speech-to-Text (STT)**: Audio duration, processing time
- **🧠 Large Language Model (LLM)**: Token usage, response time, TTFT
- **🗣️ Text-to-Speech (TTS)**: Character count, audio duration, TTFB
- **👂 Voice Activity Detection (VAD)**: Voice detection metrics
- **⏱️ End of Utterance (EOU)**: Turn-taking timing

### Conversation Analytics
- **📝 Full Transcript**: Complete conversation history with timestamps
- **🔄 Turn Tracking**: User and agent turns with associated metrics
- **📈 Performance Insights**: Response times, token usage, audio quality
- **🎯 Success Metrics**: Call completion, lesson progress, handoff detection

### Session Metadata
```python
session_id = whispey.start_session(
    session,
    phone_number="+1234567890",        # Customer contact
    customer_name="Jane Smith",        # Customer identification
    conversation_type="voice_call",    # Call type
    fpo_name="John Agent",            # Agent name
    lesson_day=3,                     # Custom metadata
    custom_field="any_value"          # Additional custom data
)
```

## 🔍 Advanced Usage

### Manual Session Control

```python
# Start session
session_id = whispey.start_session(session, **metadata)

# Get current session data (without exporting)
current_data = whispey.get_data(session_id)
print(f"Current metrics: {current_data}")

# Manually end session
whispey.end(session_id)

# Export to Whispey platform
result = await whispey.export(session_id, recording_url="https://...")
```
## 📈 Dashboard Integration

Once your data is exported, view detailed analytics at:
**[Whispey Voice Analytics Dashboard](https://pype-voice-analytics-dashboard.vercel.app/)**

### Available Analytics:
- 📊 **Call Performance**: Response times, success rates
- 🎙️ **Voice Quality**: Audio metrics, clarity scores  
- 💬 **Conversation Flow**: Turn analysis, interruption patterns
- 📈 **Usage Statistics**: Token consumption, API costs
- 🎯 **Business Metrics**: Conversion rates, customer satisfaction

## 🛠️ Troubleshooting

### Common Issues

**1. "Session not found" Error**
```python
# Ensure session_id is stored correctly
session_id = whispey.start_session(session)
print(f"Session ID: {session_id}")  # Save this for later use
```

**2. "No data available" Error**
```python
# Make sure session has activity before exporting
await asyncio.sleep(1)  # Allow time for metrics collection
result = await whispey.export(session_id)
```

**3. API Authentication Error**
```bash
# Check your .env file
echo $WHISPEY_API_KEY

# Ensure API key is set in environment
export WHISPEY_API_KEY="your_api_key_here"
```

### Debug Mode

Enable verbose logging:
```python
import logging
logging.basicConfig(level=logging.INFO)

# Your Whispey code here - you'll see detailed logs
```

## 📝 Requirements

- Python >= 3.8
- LiveKit Agents >= 1.2.2
- Active Whispey account with valid API key

## 🤝 Support

- **Documentation**: [docs.whispey.ai](https://docs.whispey.ai)
- **Dashboard**: [pype-voice-analytics-dashboard.vercel.app](https://pype-voice-analytics-dashboard.vercel.app/)
- **Email**: support@whispey.ai
- **Issues**: [GitHub Issues](https://github.com/whispey-ai/whispey/issues)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ by [Whispey Voice Analytics](https://whispey.ai)**

*Transform your voice agents with professional analytics and insights.*