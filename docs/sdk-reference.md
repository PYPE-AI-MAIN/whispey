# 🔧 SDK Reference

Complete reference for the Obsera Python SDK.

## 📦 Installation

```bash
pip install obsera
```

## 🏗️ Core Classes

### `LivekitObserve`

The main class for integrating Obsera with your LiveKit agents.

```python
from obsera import LivekitObserve

obsera = LivekitObserve(agent_id="your-agent-id")
```

#### Constructor Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent_id` | `str` | Yes | Your agent ID from the dashboard |

#### Methods

##### `start_session(session, **metadata)`

Starts tracking a LiveKit session.

```python
session_id = obsera.start_session(
    session,
    phone_number="+1234567890",
    customer_name="John Doe",
    conversation_type="voice_call",
    fpo_name="Agent Name",
    lesson_day=3,
    custom_field="any_value"
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
| `fpo_name` | `str` | Agent name/identifier |
| `lesson_day` | `int` | Custom numeric field |
| `custom_field` | `str` | Any custom string data |

##### `export(session_id, recording_url="")`

Exports session data to Obsera platform.

```python
result = await obsera.export(
    session_id,
    recording_url="https://example.com/recording.mp3"
)
```

**Parameters:**
- `session_id`: Session ID from `start_session()`
- `recording_url`: Optional recording URL

**Returns:** `dict` - Export result with success status

##### `get_data(session_id)`

Gets current session data without exporting.

```python
data = obsera.get_data(session_id)
print(f"Current metrics: {data}")
```

**Parameters:**
- `session_id`: Session ID from `start_session()`

**Returns:** `dict` - Current session metrics

##### `end(session_id)`

Manually ends a session.

```python
obsera.end(session_id)
```

**Parameters:**
- `session_id`: Session ID from `start_session()`

## 📊 Metrics Collected

### Speech-to-Text (STT) Metrics

```python
{
    "stt": {
        "audio_duration": 2.5,        # seconds
        "processing_time": 0.8,       # seconds
        "accuracy_score": 0.95,       # 0-1 scale
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
        "total_cost": 0.0023,         # USD
        "response_time": 1.2,         # seconds
        "ttft": 0.8,                 # time to first token
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
        "ttfb": 0.5,                 # time to first byte
        "total_cost": 0.0015,         # USD
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
        "silence_duration": 1.5,      # seconds
        "provider": "silero"          # provider name
    }
}
```

## 🔧 Advanced Usage

### Manual Session Control

```python
# Start session
session_id = obsera.start_session(session, **metadata)

# Get current data
current_data = obsera.get_data(session_id)

# Manually end session
obsera.end(session_id)

# Export to platform
result = await obsera.export(session_id, recording_url="https://...")
```

### Error Handling

```python
try:
    session_id = obsera.start_session(session)
    # ... your session code ...
    result = await obsera.export(session_id)
    
    if result.get("success"):
        print("✅ Data exported successfully!")
    else:
        print(f"❌ Export failed: {result.get('error')}")
        
except Exception as e:
    print(f"💥 Obsera error: {e}")
```

### Debug Mode

Enable verbose logging for troubleshooting:

```python
import logging

# Set logging level
logging.basicConfig(level=logging.INFO)

# Your Obsera code here
obsera = LivekitObserve(agent_id="your-agent-id")
```

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OBSERA_API_KEY` | Your API key | Required |
| `OBSERA_API_URL` | API endpoint | Auto-detected |

### API Endpoints

- **Production**: `https://api.obsera.ai`
- **Development**: `https://dev-api.obsera.ai`

## 📝 Examples

### Basic Integration

```python
from obsera import LivekitObserve

obsera = LivekitObserve(agent_id="your-agent-id")

# Start tracking
session_id = obsera.start_session(session)

# Export on shutdown
async def shutdown():
    await obsera.export(session_id)

ctx.add_shutdown_callback(shutdown)
```

### With Custom Metadata

```python
session_id = obsera.start_session(
    session,
    phone_number="+1234567890",
    customer_name="Jane Smith",
    conversation_type="support_call",
    fpo_name="Support Agent",
    lesson_day=1,
    custom_field="high_priority"
)
```

### Manual Export

```python
# Get current data
data = obsera.get_data(session_id)
print(f"Current metrics: {data}")

# Export with recording
result = await obsera.export(
    session_id,
    recording_url="https://storage.example.com/recording.mp3"
)
```

## 🆘 Troubleshooting

### Common Issues

**"Session not found" Error**
```python
# Ensure session_id is stored correctly
session_id = obsera.start_session(session)
print(f"Session ID: {session_id}")  # Save this
```

**"No data available" Error**
```python
# Allow time for metrics collection
await asyncio.sleep(1)
result = await obsera.export(session_id)
```

**API Authentication Error**
```bash
# Check environment variable
echo $OBSERA_API_KEY

# Set if missing
export OBSERA_API_KEY="your_api_key_here"
```

## 📚 Related Documentation

- [🚀 Getting Started Guide](getting-started.md)
- [📊 Dashboard Tutorial](dashboard-guide.md)
- [🔌 API Documentation](api-reference.md)

---

**Need help?** Join our [Discord community](https://discord.gg/pypeai) or email support@obsera.ai 