# 🔧 SDK Reference

Complete reference for the Whispey Python SDK.

## 📦 Installation

```bash
pip install whispey
```

## 🏗️ Core Classes

### `LivekitObserve`

The main class for integrating Whispey with your LiveKit agents.

```python
from whispey import LivekitObserve

whispey = LivekitObserve(
    agent_id="your-agent-id",
    apikey="your-api-key"
)
```

#### Constructor Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent_id` | `str` | Yes | Your agent ID from the dashboard |
| `apikey` | `str` | No | Your API key (can use env var) |
| `host_url` | `str` | No | Custom API endpoint |
| `bug_reports` | `bool\|dict` | No | Bug reporting configuration |
| `enable_otel` | `bool` | No | Enable OpenTelemetry |

#### Methods

##### `start_session(session, **metadata)`

Starts tracking a LiveKit session.

```python
session_id = whispey.start_session(
    session,
    phone_number="+1234567890",
    customer_name="John Doe",
    conversation_type="voice_call",
    metadata={
        "department": "support",
        "priority": "high",
        "language": "en"
    }
)
```

**Parameters:**
- `session`: LiveKit AgentSession object
- `**metadata`: Optional session metadata

**Returns:** `str` - Session ID for later reference

**Metadata Examples:**
| Field | Type | Description |
|-------|------|-------------|
| `phone_number` | `str` | Customer phone number |
| `customer_name` | `str` | Customer name |
| `conversation_type` | `str` | Type of conversation |
| `metadata` | `dict` | Custom metadata object |

##### `export(session_id, recording_url="", save_telemetry_json=False)`

Exports session data to Whispey platform. **Important**: This should only be called on shutdown.

```python
# Set up shutdown callback
async def whispey_shutdown():
    result = await whispey.export(
        session_id,
        recording_url="https://example.com/recording.mp3"  # Optional
    )
    
    if result.get("success"):
        print("✅ Successfully exported to Whispey Voice Analytics!")
    else:
        print(f"❌ Export failed: {result.get('error')}")

ctx.add_shutdown_callback(whispey_shutdown)
```

**Parameters:**
- `session_id`: Session ID from `start_session()`
- `recording_url`: Optional recording URL
- `save_telemetry_json`: Optional flag to save telemetry as JSON

**Returns:** `dict` - Export result with success status

## 📊 Metrics Collected

### Speech-to-Text (STT) Metrics

```python
{
    "stt": {
        "audio_duration": 2.5,        # seconds
        "processing_time": 0.8,       # seconds
        "provider": "deepgram",       # provider name
        "model": "nova-3"             # model used
    }
}
```

### Large Language Model (LLM) Metrics

```python
{
    "llm": {
        "input_tokens": 150,          # tokens consumed
        "output_tokens": 75,          # tokens generated
        "response_time": 1.2,         # seconds
        "provider": "openai",         # provider name
        "model": "gpt-4o-mini"       # model used
    }
}
```

### Text-to-Speech (TTS) Metrics

```python
{
    "tts": {
        "character_count": 45,        # characters processed
        "audio_duration": 3.2,        # seconds
        "provider": "elevenlabs",     # provider name
        "voice_id": "voice-id"        # voice used
    }
}
```

### Voice Activity Detection (VAD) Metrics

```python
{
    "vad": {
        "voice_detected": true,       # boolean
        "confidence": 0.92,           # 0-1 scale
        "provider": "silero"          # provider name
    }
}
```

## 🔧 Advanced Usage

### Bug Reporting Configuration

```python
whispey = LivekitObserve(
    agent_id="your-agent-id",
    apikey="your-api-key",
    bug_reports={
        "bug_start_command": ["report issue", "there's a problem"],
        "bug_end_command": ["issue resolved", "problem fixed"],
        "response": "Please describe the issue.",
        "collection_prompt": "Got it, anything else?",
        "continuation_prefix": "So, as I was saying, ",
        "fallback_message": "Let me continue our conversation."
    }
)

session_id = whispey.start_session(session)

# Export on shutdown via callback
async def whispey_shutdown():
    await whispey.export(session_id)

ctx.add_shutdown_callback(whispey_shutdown)
```

### OpenTelemetry Configuration

```python
whispey = LivekitObserve(
    agent_id="your-agent-id",
    apikey="your-api-key",
    enable_otel=True  # Enable detailed telemetry collection
)

session_id = whispey.start_session(session)

# Export on shutdown via callback
async def whispey_shutdown():
    await whispey.export(session_id)

ctx.add_shutdown_callback(whispey_shutdown)
```

### Error Handling

```python
try:
    session_id = whispey.start_session(session)
    # ... your session code ...
    
    # Set up shutdown callback
    async def whispey_shutdown():
        try:
            result = await whispey.export(session_id)
            if result.get("success"):
                print("✅ Data exported successfully!")
            else:
                print(f"❌ Export failed: {result.get('error')}")
        except Exception as e:
            print(f"Export error: {e}")
    
    ctx.add_shutdown_callback(whispey_shutdown)
    
except Exception as e:
    print(f"💥 Whispey error: {e}")
```

### Debug Mode

Enable verbose logging for troubleshooting:

```python
import logging

# Set logging level
logging.basicConfig(level=logging.INFO)

# Your Whispey code here
whispey = LivekitObserve(agent_id="your-agent-id")
```

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WHISPEY_API_KEY` | Your API key | Required |

## 📝 Examples

### Basic Integration

```python
from whispey import LivekitObserve

whispey = LivekitObserve(
    agent_id="your-agent-id",
    apikey="your-api-key"
)

# Start tracking
session_id = whispey.start_session(session)

# Export on shutdown
async def shutdown():
    await whispey.export(session_id)

ctx.add_shutdown_callback(shutdown)
```

### With Custom Metadata

```python
session_id = whispey.start_session(
    session,
    phone_number="+1234567890",
    customer_name="Jane Smith",
    conversation_type="support_call",
    metadata={
        "department": "support",
        "priority": "high",
        "agent_name": "Support Agent"
    }
)
```

### Export with Recording URL

```python
async def whispey_shutdown():
    result = await whispey.export(
        session_id,
        recording_url="https://storage.example.com/recording.mp3"
    )
    
    if result.get("success"):
        print("✅ Successfully exported with recording!")
    else:
        print(f"❌ Export failed: {result.get('error')}")

ctx.add_shutdown_callback(whispey_shutdown)
```

## 🆘 Troubleshooting

### Common Issues

**"Session not found" Error**
```python
# Ensure session_id is stored correctly
session_id = whispey.start_session(session)
print(f"Session ID: {session_id}")  # Save this
```

**API Authentication Error**
```bash
# Check environment variable
echo $WHISPEY_API_KEY

# Set if missing
export WHISPEY_API_KEY="your_api_key_here"
```

**Export Failures**
```python
# Always handle export errors gracefully
async def whispey_shutdown():
    try:
        result = await whispey.export(session_id)
        if result.get("success"):
            print("✅ Successfully exported to Whispey Voice Analytics!")
        else:
            print(f"❌ Export failed: {result.get('error')}")
    except Exception as e:
        print(f"Export error: {e}")

ctx.add_shutdown_callback(whispey_shutdown)
```

## 📚 Related Documentation

- [🚀 Getting Started Guide](getting-started.md)
- [📊 Dashboard Tutorial](dashboard-guide.md)
- [🔌 API Documentation](api-reference.md)
- [📚 GitHub Examples](https://github.com/PYPE-AI-MAIN/whispey-examples)

---

**Need help?** Email deepesh@pypeai.com or check out our [GitHub Examples Repository](https://github.com/PYPE-AI-MAIN/whispey-examples) 