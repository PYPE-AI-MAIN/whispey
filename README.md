# 🔌 Voice Analytics Platform – Integration Guide

Track, analyze, and improve your voice AI applications with real-time analytics.

---

## ✅ Quick Start

### 1. Install Dependencies

Clone the repo and install dependencies:

```bash
npm install
```

---

### 2. Set Up Supabase

We use **Supabase** for the backend database.

#### Steps:

1. Go to [https://supabase.com](https://supabase.com) and **create a new project**
2. Open the **SQL Editor** from your Supabase dashboard
3. Copy the contents of `setup-supabase.sql` from this repo and **run the script**
4. Go to **Settings → API** → **Data API**:

   * Copy your **Project URL**
   * Under **API Keys**, copy your **anon/public key**

#### Add these to your `.env` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

### 3. Run the App Locally

```bash
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Using the Dashboard

### Step 1: Create a Project

* Click **"Create New Project"**
* Enter a project name and description
* Copy the **API Token** that appears – you’ll need this for API requests

### Step 2: Create an Agent

* Go to your project → Click **"Create Agent"**
* Choose the agent type and configuration
* Copy the **Agent ID** shown after creation

---

## 🔑 Your API Credentials

You’ll need the following for API calls:

* **Project ID**: Shown in your project page
* **API Token**: Generated when creating a project
* **Agent ID**: Generated when creating an agent

---

## 📡 Send Call Logs to API

### Base URL

```
http://localhost:3000/api/send-logs
```

### Headers

```http
x-pype-token: your_dashboard_generated_token
```

---

### Example (cURL)

```bash
curl -X POST "http://localhost:3000/api/send-logs" \
  -H "Content-Type: application/json" \
  -H "x-pype-token: your_dashboard_generated_token" \
  -d '{
    "call_id": "call_12345",
    "agent_id": "your_agent_id",
    "customer_number": "+1234567890",
    "call_ended_reason": "completed",
    "transcript_type": "agent",
    "transcript_json": [
      {
        "id": "msg_1",
        "role": "user",
        "content": "Hello, I need help",
        "interrupted": false
      },
      {
        "id": "msg_2",
        "role": "assistant",
        "content": "Sure, what can I help you with?",
        "interrupted": false
      }
    ],
    "metadata": {
      "call_quality": "good"
    },
    "call_started_at": "2024-01-01T10:00:00Z",
    "call_ended_at": "2024-01-01T10:01:00Z",
    "duration_seconds": 60,
    "environment": "dev"
  }'
```

---

## 📦 API Reference

### Send Call Logs

```
POST /api/send-logs
Headers:
  - Content-Type: application/json
  - x-pype-token: your_token
```

### Send Failure Report

```
POST /api/failure-report
```

```json
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

---

## 📊 View Your Analytics

1. Go to [http://localhost:3000](http://localhost:3000)
2. Select your project and agent
3. See live data and performance metrics:

   * Call volume, durations, success rates
   * Agent response times
   * Speech-to-text (STT), LLM, and TTS metrics

---

## 💡 Best Practices

* Send data **immediately after call ends**
* Use **meaningful call IDs**
* Store your **API token securely**
* Handle API failures with **retry logic**

---

## 🛠 Troubleshooting

### "Token is required"

→ Check `x-pype-token` header is set and valid.

### "Invalid agent ID"

→ Double-check your agent ID from the dashboard.

### Timeout or connection issues

→ Confirm the API URL and network connectivity.

---

## 🚀 Ready for Production?

When deploying:

* Use your **real domain** for API base URL
* Enable **HTTPS**
* Add logging and retry logic
* Secure environment variables and tokens
