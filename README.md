# 🔌 API Integration Guide

Learn how to integrate your voice applications with the Voice Analytics Platform.

## 🚀 Quick Setup

### 1. Setup Supabase Database

First, you need to set up your database:

1. **Go to [supabase.com](https://supabase.com)** and create a new project
2. **Copy the setup script** from `setup-supabase.sql` (included in this repo)
3. **Go to your Supabase dashboard** → **SQL Editor**
4. **Paste and run the setup script** - this creates all necessary tables
5. **Get your credentials** from **Settings → API**:
   - Copy your **Project URL**
   - Copy your **anon/public key**
6. **Update `.env.local`** file:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### 2. Get Your Credentials from Dashboard

After setting up your database:

1. **Start your application**: `npm run dev`
2. **Visit the dashboard**: `http://localhost:3000`
3. **Create a project** - The dashboard will automatically generate and display your API token
4. **Copy your API token** from the project creation success page
5. **Create an agent** and note down the **Agent ID**

### 2. Your Credentials

From the dashboard, you'll have:
- **API Token**: Automatically generated when you create a project
- **Agent ID**: Generated when you create an agent (e.g., `f6fe2288-4273-4bce-a838-96617d0072f7`)
- **Project ID**: Your project's unique identifier

## 🎯 Dashboard Workflow

### Step-by-Step Process:

1. **Setup Database First**
   - Create Supabase project at [supabase.com](https://supabase.com)
   - Run `setup-supabase.sql` script in Supabase SQL Editor
   - Update `.env.local` with your Supabase credentials

2. **Access Dashboard**
   ```bash
   npm run dev
   # Visit http://localhost:3000
   ```

2. **Create Project**
   - Click "Create New Project"
   - Enter project name and description
   - **Important**: Copy the API token that appears - you'll need this for API calls
   - Note your Project ID

3. **Create Agent**
   - Navigate to your project
   - Click "Create Agent" 
   - Choose agent type and configuration
   - Copy the generated Agent ID

4. **Start Sending Data**
   - Use the API token and Agent ID in your API calls
   - Send call logs to track performance
   - View analytics in real-time on the dashboard

## 📡 Send Data to API

### Base URL
```
http://localhost:3000/api/send-logs
```

### Authentication
```bash
x-pype-token: your_dashboard_generated_token
```

> 💡 **Note**: The API token is automatically generated and displayed when you create a project in the dashboard. Make sure to copy and save it securely!

## 💡 Integration Examples

### cURL Example
```bash
curl -X POST "http://localhost:3000/api/call-logs" \
  -H "Content-Type: application/json" \
  -H "x-pype-token: your_dashboard_generated_token" \
  -d '{
    "call_id": "call_12345",
    "agent_id": "f6fe2288-4273-4bce-a838-96617d0072f7",
    "customer_number": "+1234567890",
    "call_ended_reason": "completed",
    "transcript_type": "agent",
    "transcript_json": [
      {
        "id": "msg_1",
        "role": "user",
        "type": "message",
        "content": ["Hello, I need help with my account"],
        "interrupted": false
      },
      {
        "id": "msg_2", 
        "role": "assistant",
        "type": "message",
        "content": ["Hi! I would be happy to help you with your account. What specific issue are you experiencing?"],
        "interrupted": false
      }
    ],
    "metadata": {
      "call_quality": "good",
      "lesson_day": 1
    },
    "call_started_at": "2024-01-01T10:00:00Z",
    "call_ended_at": "2024-01-01T10:01:00Z", 
    "duration_seconds": 60,
    "environment": "dev"
  }'
```

### Node.js/JavaScript Example
```javascript
const sendCallLog = async (callData) => {
  const response = await fetch('http://localhost:3000/api/call-logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pype-token': 'your_dashboard_generated_token'
    },
    body: JSON.stringify({
      call_id: "call_12345",
      agent_id: "f6fe2288-4273-4bce-a838-96617d0072f7",
      customer_number: "+1234567890",
      call_ended_reason: "completed",
      transcript_type: "agent",
      transcript_json: [
        {
          id: "msg_1",
          role: "user", 
          type: "message",
          content: ["Hello, I need help"],
          interrupted: false
        },
        {
          id: "msg_2",
          role: "assistant",
          type: "message", 
          content: ["Hi! How can I assist you today?"],
          interrupted: false
        }
      ],
      metadata: {
        call_quality: "good",
        lesson_day: 1
      },
      call_started_at: new Date(Date.now() - 60000).toISOString(),
      call_ended_at: new Date().toISOString(),
      duration_seconds: 60,
      environment: "dev"
    })
  });

  const result = await response.json();
  console.log('Call log sent:', result);
  return result;
};

// Usage
sendCallLog().catch(console.error);
```

### Python Example
```python
import requests
import json
from datetime import datetime

def send_call_log():
    url = "http://localhost:3000/api/call-logs"
    headers = {
        "Content-Type": "application/json",
        "x-pype-token": "your_dashboard_generated_token"
    }
    
    payload = {
        "call_id": "call_12345",
        "agent_id": "f6fe2288-4273-4bce-a838-96617d0072f7",
        "customer_number": "+1234567890",
        "call_ended_reason": "completed",
        "transcript_type": "agent",
        "transcript_json": [
            {
                "id": "msg_1",
                "role": "user",
                "type": "message", 
                "content": ["Hello, I need help with my account"],
                "interrupted": False
            },
            {
                "id": "msg_2",
                "role": "assistant",
                "type": "message",
                "content": ["Hi! I'd be happy to help you with your account. What specific issue are you experiencing?"],
                "interrupted": False
            }
        ],
        "metadata": {
            "call_quality": "good",
            "lesson_day": 1
        },
        "call_started_at": datetime.now().isoformat(),
        "call_ended_at": datetime.now().isoformat(),
        "duration_seconds": 60,
        "environment": "dev"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        result = response.json()
        print("✅ Call log sent successfully:", result)
        return result
    except requests.exceptions.RequestException as e:
        print(f"❌ Error sending call log: {e}")
        raise

# Usage
send_call_log()
```

## 🔄 Advanced: Send Metrics Data

For detailed performance analytics, you can also send metrics data:

### With Performance Metrics
```javascript
const sendAdvancedCallLog = async () => {
  const response = await fetch('http://localhost:3000/api/call-logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pype-token': 'your_dashboard_generated_token'
    },
    body: JSON.stringify({
      call_id: "call_advanced_123",
      agent_id: "f6fe2288-4273-4bce-a838-96617d0072f7",
      customer_number: "+1234567890",
      call_ended_reason: "completed",
      transcript_type: "agent",
      duration_seconds: 120,
      
      // Basic transcript
      transcript_json: [
        {
          id: "msg_1",
          role: "user",
          content: ["I need help with my order"]
        },
        {
          id: "msg_2", 
          role: "assistant",
          content: ["I can help you with your order. Let me look that up for you."]
        }
      ],
      
      // Advanced metrics for analytics
      transcript_with_metrics: [
        {
          turn_id: "turn_1",
          user_transcript: "I need help with my order",
          agent_response: "I can help you with your order. Let me look that up for you.",
          timestamp: Date.now() / 1000,
          stt_metrics: {
            duration: 250,        // STT processing time in ms
            confidence: 0.95
          },
          llm_metrics: {
            ttft: 150,           // Time to first token in ms
            total_time: 300,     // Total LLM processing time
            tokens: 18
          },
          tts_metrics: {
            ttfb: 100,          // Time to first byte
            duration: 800       // Total TTS duration
          },
          eou_metrics: {
            end_of_utterance_delay: 50  // End of utterance detection delay
          }
        }
      ],
      
      metadata: {
        call_quality: "excellent",
        lesson_day: 1,
        customer_satisfaction: "high"
      },
      environment: "production"
    })
  });

  const result = await response.json();
  console.log('Advanced call log sent:', result);
};
```

## 📊 What Data Gets Tracked

When you send call logs, the platform automatically tracks:

### Call Analytics
- **Call duration** and success rates
- **Customer engagement** metrics
- **Agent performance** statistics
- **Call volume** over time

### Voice Metrics (when using `transcript_with_metrics`)
- **STT Latency**: Speech-to-text processing time
- **LLM Response Time**: Language model inference speed  
- **TTS Generation**: Text-to-speech synthesis time
- **End-of-Utterance**: Voice activity detection accuracy

### Custom Metadata
- Any custom fields you include in the `metadata` object
- Dynamic variables for conversation context
- Call quality assessments

## 🛠️ API Endpoints Reference

### Send Call Logs
```
POST /api/call-logs
```
**Headers**: `x-pype-token`, `Content-Type: application/json`

### Send Failure Reports
```
POST /api/failure-report
```
```javascript
{
  "token": "your_token",
  "call_id": "failed_call_123", 
  "error_message": "Connection timeout",
  "error_type": "network_error",
  "stack_trace": "...",
  "environment": "production"
}
```

### Test Connection
```
GET /api/test-connection
```
Returns status of Supabase and ClickHouse connections.

## 🔧 Response Handling

### Success Response (200)
```json
{
  "message": "Call log saved successfully",
  "log_id": "uuid-generated-id",
  "agent_id": "your-agent-id",
  "project_id": "your-project-id"
}
```

### Error Responses
```json
// Missing token (401)
{
  "error": "Token is required"
}

// Invalid agent (400)
{
  "error": "Invalid agent ID"
}

// Server error (500)
{
  "error": "Internal server error"
}
```

## 🚀 Production Deployment

When deploying to production:

1. **Update API base URL** in your integration code
2. **Use HTTPS** for secure token transmission
3. **Implement retry logic** for failed API calls
4. **Add logging** for debugging integration issues

### Example Production Config
```javascript
const config = {
  apiUrl: process.env.NODE_ENV === 'production' 
    ? 'https://your-domain.com/api/call-logs'
    : 'http://localhost:3000/api/call-logs',
  
  retryAttempts: 3,
  timeoutMs: 5000
};
```

## 📈 View Your Analytics

After sending data:

1. **Go to your dashboard**: `http://localhost:3000`
2. **Select your project** and agent
3. **View real-time analytics**:
   - Call volume and success rates
   - Average response times
   - Customer conversation patterns
   - Voice quality metrics

## 🤝 Integration Best Practices

- **Send data immediately** after call completion
- **Include meaningful metadata** for better insights
- **Use consistent call_id format** for easier tracking
- **Handle API errors gracefully** with retry logic
- **Monitor your token usage** and rotation

## 🆘 Troubleshooting

### Common Issues

**"Token is required" error**
- Ensure `x-pype-token` header is included
- Verify token was copied correctly from dashboard

**"Invalid agent ID" error**  
- Check agent ID matches exactly from dashboard
- Ensure agent exists and is active

**Connection timeouts**
- Check your network connection
- Verify API endpoint URL is correct
- Implement retry logic for production use

---

**Ready to start tracking your voice AI performance! 🎉**