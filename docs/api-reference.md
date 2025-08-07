# 🔌 API Reference

Complete API documentation for Whispey's REST endpoints and webhooks.

## 🔑 Authentication

All API requests require authentication using your API key:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.whispey.ai/v1/agents
```

### API Key Management

Get your API key from the [Whispey Dashboard](https://pype-voice-analytics-dashboard.vercel.app/):

1. **Sign in** to your account
2. **Navigate** to Settings → API Keys
3. **Generate** a new API key
4. **Copy** the key for use in requests

## 📊 Base URL

- **Production**: `https://api.whispey.ai`
- **Development**: `https://dev-api.whispey.ai`

## 🏗️ Core Endpoints

### Agents

#### List Agents

```http
GET /v1/agents
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent-123",
      "name": "Customer Support Bot",
      "project_id": "proj-456",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "total_calls": 1250,
      "success_rate": 94.2
    }
  ]
}
```

#### Get Agent Details

```http
GET /v1/agents/{agent_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent-123",
    "name": "Customer Support Bot",
    "project_id": "proj-456",
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "metrics": {
      "total_calls": 1250,
      "success_rate": 94.2,
      "avg_duration": 180,
      "total_cost": 187.50
    }
  }
}
```

### Calls

#### List Calls

```http
GET /v1/calls?agent_id={agent_id}&limit=50&offset=0
```

**Query Parameters:**
- `agent_id` (optional): Filter by agent
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset
- `start_date` (optional): Filter from date (ISO 8601)
- `end_date` (optional): Filter to date (ISO 8601)
- `status` (optional): Filter by status (completed, failed, in_progress)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "call-789",
      "agent_id": "agent-123",
      "session_id": "session-456",
      "status": "completed",
      "duration": 180,
      "cost": 0.15,
      "created_at": "2024-01-15T14:30:00Z",
      "metadata": {
        "phone_number": "+1234567890",
        "customer_name": "John Doe"
      }
    }
  ],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

#### Get Call Details

```http
GET /v1/calls/{call_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "call-789",
    "agent_id": "agent-123",
    "session_id": "session-456",
    "status": "completed",
    "duration": 180,
    "cost": 0.15,
    "created_at": "2024-01-15T14:30:00Z",
    "metadata": {
      "phone_number": "+1234567890",
      "customer_name": "John Doe",
      "conversation_type": "support"
    },
    "transcript": [
      {
        "speaker": "user",
        "text": "I need help with my account",
        "timestamp": "2024-01-15T14:30:05Z"
      },
      {
        "speaker": "agent",
        "text": "I'd be happy to help you with your account. What specific issue are you experiencing?",
        "timestamp": "2024-01-15T14:30:08Z"
      }
    ],
    "metrics": {
      "stt_accuracy": 95.2,
      "tts_quality": 4.8,
      "response_time_avg": 1.2,
      "user_satisfaction": 4.5
    }
  }
}
```

### Analytics

#### Get Agent Analytics

```http
GET /v1/analytics/agents/{agent_id}?period=30d
```

**Query Parameters:**
- `period`: Time period (1d, 7d, 30d, 90d, 1y)

**Response:**
```json
{
  "success": true,
  "data": {
    "agent_id": "agent-123",
    "period": "30d",
    "metrics": {
      "total_calls": 1250,
      "success_rate": 94.2,
      "avg_duration": 180,
      "total_cost": 187.50,
      "cost_per_call": 0.15
    },
    "trends": {
      "calls_per_day": [45, 52, 48, 61, ...],
      "cost_per_day": [6.75, 7.80, 7.20, 9.15, ...],
      "success_rate_per_day": [92.1, 95.3, 93.8, 94.7, ...]
    },
    "provider_breakdown": {
      "openai": { "calls": 625, "cost": 93.75 },
      "deepgram": { "calls": 1250, "cost": 62.50 },
      "elevenlabs": { "calls": 1250, "cost": 31.25 }
    }
  }
}
```

#### Get Cost Analytics

```http
GET /v1/analytics/costs?agent_id={agent_id}&period=30d
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "total_cost": 187.50,
    "cost_breakdown": {
      "llm": {
        "total": 93.75,
        "percentage": 50.0,
        "providers": {
          "openai": 93.75
        }
      },
      "stt": {
        "total": 62.50,
        "percentage": 33.3,
        "providers": {
          "deepgram": 62.50
        }
      },
      "tts": {
        "total": 31.25,
        "percentage": 16.7,
        "providers": {
          "elevenlabs": 31.25
        }
      }
    },
    "daily_costs": [
      { "date": "2024-01-01", "cost": 6.25 },
      { "date": "2024-01-02", "cost": 7.50 },
      // ...
    ]
  }
}
```

## 🔔 Webhooks

### Webhook Events

Whispey can send webhook notifications for various events:

#### Event Types

- `call.completed` - Call finished successfully
- `call.failed` - Call failed or was interrupted
- `cost.alert` - Cost threshold exceeded
- `performance.alert` - Performance threshold exceeded
- `agent.status_changed` - Agent status updated

#### Webhook Payload

```json
{
  "event": "call.completed",
  "timestamp": "2024-01-15T14:30:00Z",
  "data": {
    "call_id": "call-789",
    "agent_id": "agent-123",
    "duration": 180,
    "cost": 0.15,
    "status": "completed"
  }
}
```

#### Configure Webhooks

```http
POST /v1/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/obsera",
  "events": ["call.completed", "cost.alert"],
  "secret": "your_webhook_secret"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "webhook-123",
    "url": "https://your-app.com/webhooks/obsera",
    "events": ["call.completed", "cost.alert"],
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## 📊 Data Export

### Export Calls Data

```http
POST /v1/export/calls
```

**Request Body:**
```json
{
  "agent_id": "agent-123",
  "format": "csv",
  "date_range": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "include_transcripts": true,
  "include_metrics": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "export_id": "export-456",
    "status": "processing",
    "download_url": "https://api.obsera.ai/v1/exports/export-456/download",
    "estimated_completion": "2024-01-15T15:00:00Z"
  }
}
```

### Check Export Status

```http
GET /v1/exports/{export_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "export-456",
    "status": "completed",
    "download_url": "https://api.obsera.ai/v1/exports/export-456/download",
    "file_size": "2.5MB",
    "record_count": 1250
  }
}
```

## 🔧 SDK Integration

### Python SDK

```python
from obsera import LivekitObserve

# Initialize
obsera = LivekitObserve(agent_id="your-agent-id")

# Start session
session_id = obsera.start_session(session, **metadata)

# Export data
result = await obsera.export(session_id)
```

### REST API Integration

```python
import requests

# API configuration
API_BASE = "https://api.obsera.ai/v1"
API_KEY = "your_api_key"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Get agent calls
response = requests.get(
    f"{API_BASE}/calls?agent_id=your-agent-id",
    headers=headers
)

calls = response.json()["data"]
```

## 🛠️ Error Handling

### Error Responses

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid",
    "details": {
      "api_key": "invalid_key_format"
    }
  }
}
```

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `INVALID_API_KEY` | API key is invalid or expired | Generate new API key |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Implement exponential backoff |
| `AGENT_NOT_FOUND` | Agent ID doesn't exist | Check agent ID |
| `INVALID_DATE_RANGE` | Date range is invalid | Use ISO 8601 format |
| `EXPORT_IN_PROGRESS` | Export already running | Wait for completion |

### Rate Limiting

- **Standard**: 1000 requests per hour
- **Enterprise**: 10000 requests per hour
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## 📚 SDK Methods

### Core Methods

#### `start_session(session, **metadata)`

Starts tracking a LiveKit session.

```python
session_id = obsera.start_session(
    session,
    phone_number="+1234567890",
    customer_name="John Doe"
)
```

#### `export(session_id, recording_url="")`

Exports session data to Obsera platform.

```python
result = await obsera.export(session_id, recording_url="https://...")
```

#### `get_data(session_id)`

Gets current session data without exporting.

```python
data = obsera.get_data(session_id)
```

#### `end(session_id)`

Manually ends a session.

```python
obsera.end(session_id)
```

## 🆘 Support

### Getting Help

- **📖 Documentation**: [https://pype-voice-analytics-dashboard.vercel.app/docs](https://pype-voice-analytics-dashboard.vercel.app/docs)
- **💬 Discord**: [Join our community](https://discord.gg/pypeai)
- **📧 Email**: api-support@obsera.ai
- **🐛 Issues**: [GitHub Issues](https://github.com/PYPE-AI-MAIN/obsera/issues)

### API Status

Check API status at: [https://status.obsera.ai](https://status.obsera.ai)

---

**🔌 Ready to integrate?** Start with the [Getting Started Guide](getting-started.md) or explore the [SDK Reference](sdk-reference.md). 