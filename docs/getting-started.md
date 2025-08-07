# 🚀 Getting Started Guide

Welcome to Whispey! This guide will help you get up and running with voice analytics for your AI agents in under 10 minutes.

## 📋 Prerequisites

Before you begin, make sure you have:

- **Python 3.8+** installed on your system
- **LiveKit Agents** set up in your project
- **Active internet connection** for dashboard access

## 🎯 Quick Start (2 minutes)

### Step 1: Sign Up & Get Credentials

1. **Visit the dashboard**: [https://pype-voice-analytics-dashboard.vercel.app](https://pype-voice-analytics-dashboard.vercel.app)
2. **Create an account** or sign in
3. **Create a new project** (if you don't have one)
4. **Add an agent** to your project
5. **Copy your Agent ID** from the agent settings
6. **Generate an API key** from your account settings

### Step 2: Install the SDK

```bash
pip install whispey
```

### Step 3: Set Up Environment

Create a `.env` file in your project root:

```env
# Whispey Voice Analytics
WHISPEY_API_KEY=your_api_key_here
```

### Step 4: Integrate with Your Agent

```python
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession
from whispey import LivekitObserve

# Load environment variables
load_dotenv()

# Initialize Whispey
whispey = LivekitObserve(agent_id="your-agent-id")

async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
    
    # Your existing session setup
    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=elevenlabs.TTS(voice_id="your-voice-id"),
        # ... other configurations
    )
    
    # Start Whispey tracking
    session_id = whispey.start_session(
        session,
        phone_number="+1234567890",  # Optional
        customer_name="John Doe"     # Optional
    )
    
    # Export data on shutdown
    async def shutdown():
        await whispey.export(session_id)
    
    ctx.add_shutdown_callback(shutdown)
    
    # Start your session
    await session.start(room=ctx.room, agent=YourAgent())
```

### Step 5: View Your Analytics

Visit your dashboard at [https://pype-voice-analytics-dashboard.vercel.app](https://pype-voice-analytics-dashboard.vercel.app) to see your analytics in real-time!

## 🔧 Basic Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WHISPEY_API_KEY` | Yes | Your API key from the dashboard |

### Session Metadata

You can pass additional metadata when starting a session:

```python
session_id = whispey.start_session(
    session,
    phone_number="+1234567890",        # Customer phone
    customer_name="Jane Smith",        # Customer name
    conversation_type="voice_call",    # Call type
    fpo_name="Agent Name",            # Agent identifier
    lesson_day=3,                     # Custom metadata
    custom_field="any_value"          # Additional data
)
```

## 📊 What Gets Tracked

Whispey automatically collects:

- **🎙️ Speech-to-Text**: Audio duration, processing time, accuracy
- **🧠 LLM**: Token usage, response time, model costs
- **🗣️ Text-to-Speech**: Character count, audio duration, voice quality
- **⏱️ Timing**: Turn-taking, response latency, conversation flow
- **💰 Costs**: Real-time cost tracking across all providers

## 🎯 Next Steps

- **📖 SDK Reference**: Learn about advanced features
- **📊 Dashboard Tutorial**: Master the analytics interface
- **🏠 Self-hosting**: Deploy your own instance
- **🔌 API Documentation**: Integrate with custom solutions

## 🆘 Need Help?

- **💬 Discord**: [Join our community](https://discord.gg/pypeai)
- **📧 Email**: support@whispey.ai
- **🐛 Issues**: [GitHub Issues](https://github.com/PYPE-AI-MAIN/whispey/issues)

---

**🎉 Congratulations!** You're now tracking voice analytics with Whispey. Your first call data should appear in the dashboard within minutes. 