'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  ChevronLeft,
  ExternalLink, 
  AlertCircle,
  Bot,
  Copy,
  CheckCircle,
  Calendar,
  Hash,
} from 'lucide-react'
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

  useEffect(() => {
    const fetchAgentData = async () => {
      console.log('Fetching agent data with ID:', agentId)
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/agents/${agentId}/vapi`)
        
        if (!response.ok) {
          const errorData = await response.json()
          console.error('API Error:', errorData)
          throw new Error(errorData.error || 'Failed to fetch agent data')
        }

        const data = await response.json()
                
        if (data.success && data.vapi_assistant) {
          setAgentData(data.agent)
          setAssistant(data.vapi_assistant)
          console.log('Successfully loaded assistant:', data.vapi_assistant.name)
        } else {
          console.log('No assistant data returned')
          setError('Assistant data not found')
        }
      } catch (err) {
        console.log('Error fetching agent data:', err)
        const errorMsg = err instanceof Error ? err.message : 'Failed to load agent data'
        setError(errorMsg)
        
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

  const handleBack = () => {
    router.push(`/${agentData?.project_id}/agents/${agentId}`)
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
      <div className="min-h-screen bg-muted/50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-black dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Image src="/vapi.svg" alt="Vapi Logo" width={24} height={24} />
            </div>
            <div className="w-8 h-8 border-2 border-border border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-medium text-muted-foreground">Loading assistant details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !assistant) {
    return (
      <div className="min-h-screen bg-muted/50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-16 h-16 bg-card rounded-2xl border border-border flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-400 dark:text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">Assistant Error</h3>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              
              <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg text-left">
                <p className="text-sm text-primary font-medium mb-1">Troubleshooting:</p>
                <ul className="text-xs text-primary space-y-1">
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
                className="border-border"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Agents
              </Button>
              <Button 
                onClick={() => {
                  const assistantId = agentData?.configuration?.vapi?.assistantId || agentId
                  window.open(`https://dashboard.vapi.ai/assistants/${assistantId}`, '_blank')
                }}
                className="text-white bg-blue-600 hover:bg-blue-700 transition-colors"
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
    <div className="h-screen bg-muted/50 flex flex-col overflow-hidden">
      
      {/* Top Header Bar */}
      <div className="bg-card border-b border-border flex-shrink-0">
        <div className="w-full px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleBack}
                variant="ghost"
                size="sm"
                className="p-1 hover:bg-muted"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </Button>
              
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {assistant.name || 'Unnamed Assistant'}
                  </h1>
                  {isConnected ? (
                    <Badge className="bg-success/15 text-success border-success/30 text-xs">
                      <CheckCircle className="w-2 h-2 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                      <AlertCircle className="w-2 h-2 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
              <CallDialog 
                agentId={agentId}
                assistantName={assistant.name || 'Unnamed Assistant'}
                vapiAssistantId={assistant.id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-2 p-2 overflow-hidden">
        {/* Left Side - System Prompt */}
        <div className="w-2/3 flex-1 min-w-0">
          <div className="bg-card border border-border rounded-lg flex flex-col h-full">
            <div className="p-4 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">System Prompt</h3>
                    <p className="text-xs text-muted-foreground">
                      {getSystemPrompt().length.toLocaleString()} characters • 
                      {Math.ceil(getSystemPrompt().length / 4)} estimated tokens
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(getSystemPrompt(), 'prompt')}
                  className="text-xs border-border"
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
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Textarea
                value={getSystemPrompt()}
                disabled
                className="w-full h-full border-0 resize-none font-mono text-sm bg-card text-foreground focus-visible:ring-0"
                style={{
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Side - Configuration Sidebar */}
        <div className="w-1/3 bg-muted/50 border border-border rounded-lg flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Configuration Overview</h3>
              
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                  <span className={`text-sm font-medium ${isConnected ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {isConnected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                {!isConnected && (
                  <p className="text-xs text-muted-foreground mb-3">Configure server URL for webhooks</p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model</span>
                    <span className="text-xs text-muted-foreground">{assistant.model?.provider}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{assistant.model?.model}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Voice</span>
                    <span className="text-xs text-muted-foreground">{assistant.voice?.provider}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{assistant.voice?.voiceId}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VapiDashboard