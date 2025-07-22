"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Copy, 
  Check, 
  ArrowLeft,
  Code,
  Terminal,
  Book,
  Zap
} from 'lucide-react'
import Link from 'next/link'

const ApiDocumentationPage = () => {
  const [copiedSections, setCopiedSections] = useState<Record<string, boolean>>({})

  const handleCopy = async (text: string, sectionId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSections(prev => ({ ...prev, [sectionId]: true }))
      setTimeout(() => {
        setCopiedSections(prev => ({ ...prev, [sectionId]: false }))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const CopyButton = ({ text, sectionId }: { text: string, sectionId: string }) => (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => handleCopy(text, sectionId)}
      className="absolute top-2 right-2 h-8 w-8 p-0"
    >
      {copiedSections[sectionId] ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  )

  const curlExample = `curl -X POST "https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log" \\
  -H "Content-Type: application/json" \\
  -H "x-pype-token: pype_your_api_token_here" \\
  -d '{
    "call_id": "1234567890",
    "agent_id": "your-agent-id",
    "customer_number": "+1234567890",
    "call_ended_reason": "completed",
    "transcript_type": "livekit",
    "transcript_json": [
      {
        "speaker": "agent",
        "text": "Hello, how can I help you?",
        "timestamp": 1640995200
      },
      {
        "speaker": "customer", 
        "text": "I need help with my account",
        "timestamp": 1640995205
      }
    ],
    "metadata": {
      "call_quality": "good",
      "duration": 60
    },
    "call_started_at": "2024-01-01T10:00:00Z",
    "call_ended_at": "2024-01-01T10:01:00Z",
    "duration_seconds": 60,
    "environment": "dev"
  }'`

  const jsExample = `import axios from 'axios';

const sendCallLog = async (callData) => {
  try {
    const response = await axios.post('https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log', {
      call_id: "1234567890",
      agent_id: "your-agent-id",
      customer_number: "+1234567890",
      call_ended_reason: "completed",
      transcript_type: "livekit",
      transcript_json: [
        {
          speaker: "agent",
          text: "Hello, how can I help you?",
          timestamp: Date.now() - 60000
        },
        {
          speaker: "customer",
          text: "I need help with my account", 
          timestamp: Date.now() - 55000
        }
      ],
      metadata: {
        call_quality: "good",
        duration: 60
      },
      call_started_at: new Date(Date.now() - 60000).toISOString(),
      call_ended_at: new Date().toISOString(),
      duration_seconds: 60,
      environment: "dev"
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-pype-token': 'pype_your_api_token_here'
      }
    });
    
    console.log('Call log sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending call log:', error);
    throw error;
  }
};`

  const pythonExample = `import asyncio
import aiohttp
import json
from datetime import datetime

async def send_call_log(call_data):
    url = "https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log"
    headers = {
        "Content-Type": "application/json",
        "x-pype-token": "pype_your_api_token_here"
    }
    
    payload = {
        "call_id": "1234567890",
        "agent_id": "your-agent-id",
        "customer_number": "+1234567890",
        "call_ended_reason": "completed",
        "transcript_type": "livekit",
        "transcript_json": [
            {
                "speaker": "agent",
                "text": "Hello, how can I help you?",
                "timestamp": datetime.now().timestamp() - 60
            },
            {
                "speaker": "customer",
                "text": "I need help with my account",
                "timestamp": datetime.now().timestamp() - 55
            }
        ],
        "metadata": {
            "call_quality": "good",
            "duration": 60
        },
        "call_started_at": datetime.now().isoformat(),
        "call_ended_at": datetime.now().isoformat(),
        "duration_seconds": 60,
        "environment": "dev"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers) as response:
            if response.status == 200:
                result = await response.json()
                print("✅ Call log sent successfully:", result)
                return result
            else:
                error_text = await response.text()
                print(f"❌ Error {response.status}: {error_text}")
                raise Exception(f"API request failed: {error_text}")

# Usage
asyncio.run(send_call_log({})))`

  const basicTranscriptExample = `{
  "call_id": "1234567890",
  "agent_id": "your-agent-id",
  "customer_number": "+1234567890",
  "call_ended_reason": "completed",
  "transcript_type": "livekit",
  "transcript_json": [
    {
      "speaker": "assistant",
      "text": "Hello, how can I help you?",
      "timestamp": 1640995200
    },
    {
      "speaker": "user", 
      "text": "I need help with my account",
      "timestamp": 1640995205
    },
    {
      "speaker": "assistant",
      "text": "I'd be happy to help you with your account. What specific issue are you having?",
      "timestamp": 1640995210
    }
  ],
  "metadata": {
    "call_quality": "good",
    "duration": 60
  },
  "call_started_at": "2024-01-01T10:00:00Z",
  "call_ended_at": "2024-01-01T10:01:00Z",
  "duration_seconds": 60,
  "environment": "dev"
}`

  const metricsExample = `{
  "call_id": "call_123",
  "agent_id": "agent_456",
  "transcript_with_metrics": [
    {
      "turn_id": 1,
      "user_transcript": "Hello, I need help",
      "agent_response": "Hi! I'm here to help you.",
      "timestamp": 1640995200,
      "stt_metrics": {
        "duration": 250,
        "confidence": 0.95
      },
      "llm_metrics": {
        "ttft": 150,
        "total_time": 300,
        "tokens": 12
      },
      "tts_metrics": {
        "ttfb": 100,
        "duration": 800
      },
      "eou_metrics": {
        "end_of_utterance_delay": 50
      }
    },
    {
      "turn_id": 2,
      "user_transcript": "My account is locked",
      "agent_response": "I can help you unlock your account. Let me check that for you.",
      "timestamp": 1640995220,
      "stt_metrics": {
        "duration": 180,
        "confidence": 0.92
      },
      "llm_metrics": {
        "ttft": 120,
        "total_time": 280,
        "tokens": 15
      },
      "tts_metrics": {
        "ttfb": 90,
        "duration": 750
      },
      "eou_metrics": {
        "end_of_utterance_delay": 45
      }
    }
  ],
  "call_ended_reason": "completed",
  "environment": "dev"
}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Book className="h-6 w-6 text-blue-600" />
                  Pype Voice API Documentation
                </h1>
                <p className="text-gray-600 text-sm mt-1">
                  Send call logs and observability data to your Pype Voice dashboard
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Quick Start */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-600" />
                Quick Start
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900">1. Get Your Token</h3>
                  <p className="text-blue-700 text-sm">Create an agent to get your API token</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-900">2. Send Call Logs</h3>
                  <p className="text-green-700 text-sm">POST to the observability endpoint</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-900">3. View Analytics</h3>
                  <p className="text-purple-700 text-sm">Monitor your agents in real-time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Endpoint */}
          <Card>
            <CardHeader>
              <CardTitle>API Endpoint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                All requests should be sent to the following endpoint:
              </p>
              <div className="relative">
                <pre className="bg-blue-900 text-blue-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                  <code>https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log</code>
                </pre>
                <CopyButton text="https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log" sectionId="api-endpoint" />
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-blue-800 text-sm font-medium">Method: POST</p>
                  <p className="text-blue-700 text-sm">Send call logs and observability data to this endpoint.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Authentication */}
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                All API requests require authentication using your agent's API token in the header:
              </p>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>x-pype-token: pype_your_api_token_here</code>
                </pre>
                <CopyButton text="x-pype-token: pype_your_api_token_here" sectionId="auth-header" />
              </div>
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-yellow-800 text-sm font-medium">Security Note</p>
                  <p className="text-yellow-700 text-sm">Keep your API tokens secure. Never expose them in client-side code.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Curl Example */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                cURL Example
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed">
                  <code>{curlExample}</code>
                </pre>
                <CopyButton text={curlExample} sectionId="curl-example" />
              </div>
            </CardContent>
          </Card>

          {/* JavaScript Example */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                JavaScript/Node.js
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed">
                  <code>{jsExample}</code>
                </pre>
                <CopyButton text={jsExample} sectionId="js-example" />
              </div>
            </CardContent>
          </Card>

          {/* Python Example */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Python
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed">
                  <code>{pythonExample}</code>
                </pre>
                <CopyButton text={pythonExample} sectionId="python-example" />
              </div>
            </CardContent>
          </Card>

          {/* Request Schema */}
          <Card>
            <CardHeader>
              <CardTitle>Request Schema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <h3 className="font-semibold text-lg">Required Fields</h3>
                <div className="space-y-3">
                  {[
                    { field: 'call_id', type: 'string', desc: 'Unique identifier for the call' },
                    { field: 'agent_id', type: 'string', desc: 'Your agent UUID from the dashboard' }
                  ].map((item) => (
                    <div key={item.field} className="flex items-center gap-4 p-3 bg-red-50 rounded-lg">
                      <code className="font-mono text-sm bg-red-100 px-2 py-1 rounded">{item.field}</code>
                      <Badge variant="outline">{item.type}</Badge>
                      <span className="text-gray-600 text-sm">{item.desc}</span>
                    </div>
                  ))}
                </div>

                <h3 className="font-semibold text-lg mt-6">Optional Fields</h3>
                <div className="space-y-3">
                  {[
                    { field: 'customer_number', type: 'string', desc: 'Phone number or customer identifier' },
                    { field: 'call_ended_reason', type: 'string', desc: 'completed, error, timeout, etc.' },
                    { field: 'transcript_json', type: 'array', desc: 'Array of conversation turns' },
                    { field: 'metadata', type: 'object', desc: 'Custom metadata about the call' },
                    { field: 'call_started_at', type: 'string', desc: 'ISO timestamp when call started' },
                    { field: 'call_ended_at', type: 'string', desc: 'ISO timestamp when call ended' },
                    { field: 'duration_seconds', type: 'number', desc: 'Total call duration in seconds' },
                    { field: 'recording_url', type: 'string', desc: 'URL to the call recording' },
                    { field: 'environment', type: 'string', desc: 'dev, staging, or production (default: dev)' }
                  ].map((item) => (
                    <div key={item.field} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{item.field}</code>
                      <Badge variant="secondary">{item.type}</Badge>
                      <span className="text-gray-600 text-sm">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transcription Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Transcription Data - Two Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-gray-600">
                You can send transcription data in two ways depending on your needs:
              </p>
              
              {/* Option 1: Basic Transcript */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Badge variant="secondary">Option 1</Badge>
                  Basic Transcript (transcript_json)
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  Simple conversation format with speaker, text, and timestamp. Perfect for basic analytics and conversation tracking.
                </p>
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed">
                    <code>{basicTranscriptExample}</code>
                  </pre>
                  <CopyButton text={basicTranscriptExample} sectionId="basic-transcript-example" />
                </div>
              </div>

              {/* Option 2: Advanced with Metrics */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Badge variant="default">Option 2</Badge>
                  Advanced with Metrics (transcript_with_metrics)
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  Detailed format with performance metrics for each conversation turn. Includes STT, LLM, TTS, and End-of-Utterance latencies for comprehensive analytics.
                </p>
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed">
                    <code>{metricsExample}</code>
                  </pre>
                  <CopyButton text={metricsExample} sectionId="metrics-example" />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Choose Your Method:</h4>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• <strong>transcript_json</strong> - Use for simple conversation logging</li>
                  <li>• <strong>transcript_with_metrics</strong> - Use for detailed performance analytics</li>
                  <li>• You can send both in the same request if needed</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Response */}
          <Card>
            <CardHeader>
              <CardTitle>Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">Success Response (200)</h3>
              <div className="relative">
                <pre className="bg-green-900 text-green-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`{
  "message": "Call log saved successfully",
  "log_id": "uuid-generated-id",
  "agent_id": "your-agent-id",
  "project_id": "your-project-id"
}`}</code>
                </pre>
              </div>

              <h3 className="font-semibold mt-6">Error Response (400/401/500)</h3>
              <div className="relative">
                <pre className="bg-red-900 text-red-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`{
  "error": "Token is required"
}`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900">Per Minute</h3>
                  <p className="text-2xl font-bold text-blue-600">60 requests</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-900">Per Hour</h3>
                  <p className="text-2xl font-bold text-purple-600">1,000 requests</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm">
                Rate limits are per API token. Contact support if you need higher limits.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default ApiDocumentationPage 