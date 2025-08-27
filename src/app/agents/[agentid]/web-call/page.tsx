'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, Info, Globe, Shield, MessageSquare } from 'lucide-react'
import { WebCallWidget } from '@/components/vapi/WebCallWidget'
import Link from 'next/link'

interface AgentData {
  id: string
  name: string
  configuration: {
    vapi?: {
      assistantId?: string
    }
  }
}

export default function WebCallPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const agentId = params.agentid as string
  const assistantId = searchParams.get('assistant')
  
  const [agentData, setAgentData] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [callHistory, setCallHistory] = useState<Array<{
    id: string
    startTime: Date
    endTime?: Date
    reason?: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }>>([])

  // Your Vapi public API key
  const VAPI_PUBLIC_KEY = '64dc1d61-4156-42ea-aa75-fc86ff0f3ceb'

  useEffect(() => {
    fetchAgentData()
  }, [agentId])

  const fetchAgentData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/agents/${agentId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.status}`)
      }

      const data = await response.json()
      setAgentData(data)
      
      console.log('✅ Agent data fetched:', data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch agent data'
      setError(errorMessage)
      console.error('❌ Error fetching agent:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCallStart = (callId: string) => {
    console.log('🚀 handleCallStart called in page component')
    console.log('🆔 Call ID received:', callId)
    console.log('⏰ Start time:', new Date().toISOString())
    
    setCallHistory(prev => {
      const newCall = {
        id: callId,
        startTime: new Date(),
        messages: []
      }
      console.log('💾 Adding new call to history:', newCall)
      return [...prev, newCall]
    })
    
    console.log('✅ Call history updated successfully')
  }

  const handleCallEnd = (callId: string, reason: string) => {
    console.log('🛑 handleCallEnd called in page component')
    console.log('🆔 Call ID received:', callId)
    console.log('🔍 End reason:', reason)
    console.log('⏰ End time:', new Date().toISOString())
    
    setCallHistory(prev => {
      const updatedHistory = prev.map(call => 
        call.id === callId 
          ? { ...call, endTime: new Date(), reason }
          : call
      )
      console.log('💾 Updated call history:', updatedHistory)
      return updatedHistory
    })
    
    console.log('✅ Call history updated successfully')
  }

  const handleTranscript = (transcript: string, role: 'user' | 'assistant') => {
    console.log('💬 Transcript:', role, transcript)
    setCallHistory(prev => {
      const lastCall = prev[prev.length - 1]
      if (lastCall && !lastCall.endTime) {
        return prev.map((call, index) => 
          index === prev.length - 1
            ? { ...call, messages: [...call.messages, { role, content: transcript }] }
            : call
        )
      }
      return prev
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading agent configuration...</p>
        </div>
      </div>
    )
  }

  if (error || !agentData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Agent</CardTitle>
            <CardDescription>
              {error || 'Failed to load agent data'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Please check that the agent ID is correct and try again.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={fetchAgentData} variant="outline">
                Retry
              </Button>
              <Link href="/dashboard">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const vapiAssistantId = assistantId || agentData.configuration?.vapi?.assistantId

  if (!vapiAssistantId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-amber-600">Configuration Missing</CardTitle>
            <CardDescription>
              This agent is not configured for Vapi web calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                The agent needs a Vapi assistant ID configured to enable web calls.
              </AlertDescription>
            </Alert>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Web Call - {agentData.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Browser-based voice conversation using Vapi web SDK
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Info Alert */}
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <Info className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Client-Side Web Calls:</strong> This implementation uses the Vapi web SDK with your public API key. 
            Voice conversations happen directly in your browser for the best user experience.
          </AlertDescription>
        </Alert>

        {/* Agent Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Agent Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Agent Name
                </label>
                <p className="text-gray-900 dark:text-white">{agentData.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Vapi Assistant ID
                </label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {vapiAssistantId}
                  </Badge>
                  <Shield className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  API Key Type
                </label>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700 text-xs">
                    Public Key
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {VAPI_PUBLIC_KEY.slice(0, 8)}...{VAPI_PUBLIC_KEY.slice(-8)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Web Call Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Live Web Call
            </h2>
            <WebCallWidget
              agentId={agentId}
              assistantId={vapiAssistantId}
              agentName={agentData.name}
              publicApiKey={VAPI_PUBLIC_KEY}
              onCallStart={handleCallStart}
              onCallEnd={handleCallEnd}
              onTranscript={handleTranscript}
            />
          </div>

          {/* Call History */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Call History
            </h2>
            {callHistory.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No calls yet</p>
                  <p className="text-sm">Start a web call to see history here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {callHistory.map((call) => (
                  <Card key={call.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            {call.id.slice(0, 8)}...
                          </Badge>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {call.startTime.toLocaleTimeString()}
                          </span>
                        </div>
                        {call.endTime && (
                          <Badge variant="secondary" className="text-xs">
                            {call.reason || 'ended'}
                          </Badge>
                        )}
                      </div>
                      
                      {call.messages.length > 0 && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <p><strong>Messages:</strong> {call.messages.length}</p>
                          <p><strong>Duration:</strong> {
                            call.endTime 
                              ? `${Math.round((call.endTime.getTime() - call.startTime.getTime()) / 1000)}s`
                              : 'Active'
                          }</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Technical Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
            <CardDescription>
              Understanding the client-side web call architecture
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl mb-2">1️⃣</div>
                <h4 className="font-medium mb-1">Browser Request</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  User clicks "Start Call" in the browser
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl mb-2">2️⃣</div>
                <h4 className="font-medium mb-1">Direct Connection</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Browser connects directly to Vapi using public key
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl mb-2">3️⃣</div>
                <h4 className="font-medium mb-1">Real-time Voice</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Voice conversation happens in real-time in the browser
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 