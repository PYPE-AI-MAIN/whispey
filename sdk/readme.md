# Obsera SDK

**Professional Voice Analytics for AI Agents**

Monitor, analyze, and gain insights from your AI voice agent conversations with Obsera's advanced voice analytics platform.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-v3.8+-blue.svg)](https://www.python.org/downloads/)
[![PyPI version](https://badge.fury.io/py/obsera.svg)](https://badge.fury.io/py/obsera)
[![Documentation](https://img.shields.io/badge/docs-available-brightgreen.svg)](https://pype-voice-analytics-dashboard.vercel.app/docs)

**Transform your voice agents with professional analytics and insights.**

[📊 Live Demo](https://pype-voice-analytics-dashboard.vercel.app) • [📖 Documentation](https://pype-voice-analytics-dashboard.vercel.app/docs) • [💬 Discord](https://discord.gg/pypeai) • [⭐ Star on GitHub](https://github.com/obsera-ai/obsera)

</div>

## 🚀 Quick Start

### Installation

```bash
pip install obsera
```

### Get Your Credentials

1. **Sign up** at [Obsera Voice Analytics Dashboard](https://pype-voice-analytics-dashboard.vercel.app/)
2. **Get your Agent ID** from the dashboard
3. **Generate your API Key** from your account 

### Environment Setup

Create a `.env` file in your project root:

```env
# Obsera Voice Analytics
OBSERA_API_KEY=your_obsera_api_key_here
```

## 📖 Complete Implementation

Here's a complete example of how to integrate Obsera into your LiveKit voice agent:

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
from obsera import LivekitObserve

import base64
import os

# Load environment variables
load_dotenv()

# 🎙️ Initialize Obsera with your Agent ID from the dashboard
obsera = LivekitObserve(
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
    
    # 🚀 Start Obsera Voice Analytics
    session_id = obsera.start_session(
        session,
        phone_number="+1234567890",     # Optional: Customer phone number
        customer_name="John Doe",       # Optional: Customer name
        conversation_type="voice_call"  # Optional: Type of conversation
    )
    
    print(f"🎙️ Obsera Analytics started for session: {session_id}")

    # 📤 Export analytics data when session ends
    async def obsera_shutdown():
        try:
            result = await obsera.export(
                session_id,
                recording_url=""  # Optional: Add recording URL if available
            )
            
            if result.get("success"):
                print("✅ Successfully exported to Obsera Voice Analytics!")
                print(f"📊 Log ID: {result.get('data', {}).get('log_id')}")
            else:
                print(f"❌ Export failed: {result.get('error')}")
                
        except Exception as e:
            print(f"💥 Export error: {e}")

    # Register cleanup callback
    ctx.add_shutdown_callback(obsera_shutdown)

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
| `OBSERA_API_KEY` | Your Obsera API authentication key | [Dashboard → API Keys](https://pype-voice-analytics-dashboard.vercel.app/) |

### Agent Configuration

Replace `"your-agent-id-from-dashboard"` with your actual Agent ID from the Obsera dashboard:

```python
obsera = LivekitObserve(
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
session_id = obsera.start_session(
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
session_id = obsera.start_session(session, **metadata)

# Get current session data (without exporting)
current_data = obsera.get_data(session_id)
print(f"Current metrics: {current_data}")

# Manually end session
obsera.end(session_id)

# Export to Obsera platform
result = await obsera.export(session_id, recording_url="https://...")
```

## 📈 Dashboard Integration

Once your data is exported, view detailed analytics at:
**[Obsera Voice Analytics Dashboard](https://pype-voice-analytics-dashboard.vercel.app/)**

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
session_id = obsera.start_session(session)
print(f"Session ID: {session_id}")  # Save this for later use
```

**2. "No data available" Error**
```python
# Make sure session has activity before exporting
await asyncio.sleep(1)  # Allow time for metrics collection
result = await obsera.export(session_id)
```

**3. API Authentication Error**
```bash
# Check your .env file
echo $OBSERA_API_KEY

# Ensure API key is set in environment
export OBSERA_API_KEY="your_api_key_here"
```

### Debug Mode

Enable verbose logging:
```python
import logging
logging.basicConfig(level=logging.INFO)

# Your Obsera code here - you'll see detailed logs
```

## 📝 Requirements

- Python >= 3.8
- LiveKit Agents >= 1.2.2
- Active Obsera account with valid API key

## 🤝 Contributing

We welcome contributions to the Obsera SDK! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Make your changes** and add tests
4. **Run the test suite:** `python -m pytest`
5. **Commit your changes:** `git commit -m 'Add amazing feature'`
6. **Push to the branch:** `git push origin feature/amazing-feature`
7. **Open a Pull Request**

Please read our [Contributing Guidelines](../CONTRIBUTING.md) and [Code of Conduct](../CODE_OF_CONDUCT.md) before contributing.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/obsera-ai/obsera
cd obsera/sdk

# Install dependencies
pip install -r requirements.txt

# Install in development mode
pip install -e .

# Run tests
python -m pytest
```

## 💬 Community & Support

- **🐛 Bug Reports:** [GitHub Issues](https://github.com/obsera-ai/obsera/issues)
- **💡 Feature Requests:** [GitHub Discussions](https://github.com/obsera-ai/obsera/discussions)
- **💬 Chat:** [Discord Community](https://discord.gg/pypeai)
- **📧 Email:** support@obsera.ai
- **📱 Twitter:** [@ObseraAI](https://twitter.com/ObseraAI)

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [Obsera Voice Analytics](https://obsera.ai)**

*Transform your voice agents with professional analytics and insights.*

</div>