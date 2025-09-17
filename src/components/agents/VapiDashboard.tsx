'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  ArrowLeft, 
  ExternalLink, 
  AlertCircle,
  Bot,
  Copy,
  CheckCircle,
  Calendar,
  Hash,
  Maximize2,
} from 'lucide-react'
import Header from '../shared/Header'
import CallDialog from '../vapi/VapiCallDialog'

interface VapiDashboardProps {
  agentId: string
}

const VapiDashboard: React.FC<VapiDashboardProps> = ({ agentId }) => {
  const router = useRouter()
  const [agentData, setAgentData] = useState<any>(null)
  const [assistant, setAssistant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState('')
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)
  
  const [breadcrumb, setBreadcrumb] = useState<{
    project?: string;
    item?: string;
  }>({
    project: 'Voice AI Platform',
    item: 'Assistant Details'
  })

  // ✅ This is the RIGHT approach - using encrypted keys from the specific agent
  useEffect(() => {
    const fetchAgentData = async () => {
      console.log('🔍 VapiDashboard: Fetching agent data with ID:', agentId)
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/agents/${agentId}/vapi`)
        
        if (!response.ok) {
          const errorData = await response.json()
          console.error('❌ VapiDashboard: API Error:', errorData)
          throw new Error(errorData.error || 'Failed to fetch agent data')
        }

        const data = await response.json()
                
        if (data.success && data.vapi_assistant) {
          setAgentData(data.agent)
          setAssistant(data.vapi_assistant)
          setBreadcrumb({
            project: 'Voice AI Platform',
            item: data.vapi_assistant.name || 'Assistant Details'
          })
          console.log('✅ VapiDashboard: Successfully loaded assistant:', data.vapi_assistant.name)
        } else {
          console.log('❌ VapiDashboard: No assistant data returned')
          setError('Assistant data not found')
        }
      } catch (err) {
        console.log('💥 VapiDashboard: Error fetching agent data:', err)
        const errorMsg = err instanceof Error ? err.message : 'Failed to load agent data'
        setError(errorMsg)
        
        // ✅ Better error handling - show specific error types
        if (errorMsg.includes('401')) {
          setError('Invalid Vapi API key. Please check your API key in the agent configuration.')
        } else if (errorMsg.includes('404')) {
          setError('Assistant not found. The assistant may have been deleted from Vapi.')
        } else if (errorMsg.includes('Failed to decrypt')) {
          setError('Unable to decrypt Vapi keys. Please recreate the agent.')
        }
      } finally {
        setLoading(false)
      }
    }

    if (agentId) {
      fetchAgentData()
    }
  }, [agentId])

  const makeVapiCall = async (callData: any) => {
    try {
      console.log('📞 Making secure Vapi call through backend...')
      
      const response = await fetch(`/api/agents/${agentId}/vapi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_call',
          ...callData
        })
      })

      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Vapi call created:', result.data)
        return result.data
      } else {
        throw new Error(result.error || 'Failed to create call')
      }
    } catch (error) {
      console.error('❌ Error making Vapi call:', error)
      throw error
    }
  }

  const handleBack = () => {
    router.push(`agents/${agentId}?tab=overview`)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const isConnected = Boolean(assistant?.serverUrl)
  
  const getSystemPrompt = () => {
    const systemMessage = assistant?.model?.messages?.find((msg: any) => msg.role === 'system')
    return systemMessage?.content || 'No system prompt configured'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
        <Header breadcrumb={breadcrumb} />
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Image src="/vapi.svg" alt="Vapi Logo" width={24} height={24} />
            </div>
            <div className="w-8 h-8 border-2 border-gray-300 rounded-full animate-spin mx-auto" style={{ borderTopColor: '#328c81' }}></div>
            <p className="text-sm font-medium text-gray-600">Loading assistant details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !assistant) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
        <Header breadcrumb={breadcrumb} />
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-16 h-16 bg-white rounded-2xl border border-gray-200 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Assistant Error</h3>
              <p className="text-sm text-gray-500 mt-2">{error}</p>
              
              {/* ✅ Better error guidance */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
                <p className="text-sm text-blue-800 font-medium mb-1">Troubleshooting:</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Make sure you used the correct Vapi API key format</li>
                  <li>• Check that the assistant exists in your Vapi dashboard</li>
                  <li>• Verify your Vapi API key has the correct permissions</li>
                  <li>• Try regenerating your API key in Vapi dashboard</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={handleBack}
                variant="outline"
                className="border-gray-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Agents
              </Button>
              <Button 
                onClick={() => {
                  // ✅ Use the actual assistant ID from configuration, not agentId
                  const assistantId = agentData?.configuration?.vapi?.assistantId || agentId
                  window.open(`https://dashboard.vapi.ai/assistants/${assistantId}`, '_blank')
                }}
                className="text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#328c81' }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Vapi Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
      <Header breadcrumb={breadcrumb} />
      
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="w-full px-8 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-semibold text-gray-900">
                    {assistant.name || 'Unnamed Assistant'}
                  </h1>
                  {isConnected ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                      <CheckCircle className="w-2 h-2 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                      <AlertCircle className="w-2 h-2 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {agentId.slice(0, 8)}...
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Updated {formatDate(assistant.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleBack}
                variant="outline"
                size="sm"
                className="border-gray-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              {/* ✅ Call Dialog with makeVapiCall function */}
              <CallDialog 
                agentId={agentId}
                assistantName={assistant.name || 'Unnamed Assistant'}
                vapiAssistantId={assistant.id}
              />
              
              {/* Rest of your UI stays the same... */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - keeping your existing UI */}
      <div className="w-full h-full">
        <div className="w-full flex gap-2" style={{ height: 'calc(100vh - 160px)' }}>
          {/* Left Side - System Prompt */}
          <div className="w-2/3 flex-1 min-w-0 pl-2 py-3">
            <div className="bg-white border border-gray-200 rounded-lg flex flex-col" style={{ height: isPromptExpanded ? '85vh' : '70vh' }}>
              <div className="p-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Bot className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">System Prompt</h3>
                      <p className="text-xs text-gray-500">
                        {getSystemPrompt().length.toLocaleString()} characters • 
                        {Math.ceil(getSystemPrompt().length / 4)} estimated tokens
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(getSystemPrompt(), 'prompt')}
                      className="text-xs"
                    >
                      {copied === 'prompt' ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                      className="text-xs"
                    >
                      <Maximize2 className="w-3 h-3 mr-1" />
                      {isPromptExpanded ? 'Collapse' : 'Expand'}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <Textarea
                  value={getSystemPrompt()}
                  disabled
                  className="w-full h-full border-0 resize-none font-mono text-sm bg-white focus-visible:ring-0 overflow-y-auto"
                  style={{
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Side - Configuration Sidebar - keeping your existing sidebar */}
          <div className="w-1/3 bg-gray-50/50 border-l border-gray-200 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Your existing sidebar content */}
              <div>
                <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">Configuration Overview</h3>
                
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                    <span className={`text-sm font-medium ${isConnected ? 'text-green-700' : 'text-amber-700'}`}>
                      {isConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  {!isConnected && (
                    <p className="text-xs text-gray-600 mb-3">Configure server URL for webhooks</p>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Model</span>
                      <span className="text-xs text-gray-400">{assistant.model?.provider}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{assistant.model?.model}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Voice</span>
                      <span className="text-xs text-gray-400">{assistant.voice?.provider}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{assistant.voice?.voiceId}</p>
                  </div>
                </div>
              </div>
              
              {/* Rest of your sidebar content... */}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VapiDashboard