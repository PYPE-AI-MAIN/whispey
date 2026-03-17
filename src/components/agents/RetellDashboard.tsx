'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Mic,
  Brain,
} from 'lucide-react'

interface RetellDashboardProps {
  agentId: string
}

const RetellDashboard: React.FC<RetellDashboardProps> = ({ agentId }) => {
  const router = useRouter()
  const [agentData, setAgentData] = useState<any>(null)
  const [retellAgent, setRetellAgent] = useState<any>(null)
  const [retellLlm, setRetellLlm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const fetchAgentData = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/agents/${agentId}/retell`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch agent data')
        }

        if (data.success) {
          setAgentData(data.agent)
          setRetellAgent(data.retell_agent)
          setRetellLlm(data.retell_llm)
        } else {
          throw new Error('Agent data not found')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load agent data'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    if (agentId) fetchAgentData()
  }, [agentId])

  const handleBack = () => {
    router.push(`/${agentData?.project_id}/agents/${agentId}`)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const isConnected = Boolean(retellAgent?.webhook_url)

  const getSystemPrompt = (): string => {
    if (retellLlm?.general_prompt) return retellLlm.general_prompt
    if (retellAgent?.response_engine?.type === 'custom-llm') return '(Custom LLM — prompt lives on your backend)'
    return 'No system prompt found'
  }

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 rounded-full animate-spin mx-auto" style={{ borderTopColor: '#328c81' }} />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Loading agent details...</p>
        </div>
      </div>
    )
  }

  if (error || !retellAgent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Agent Error</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{error}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleBack} variant="outline">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() => window.open(`https://dashboard.retellai.com/agent/${retellAgent?.agent_id || ''}`, '_blank')}
              style={{ backgroundColor: '#328c81' }}
              className="text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Retell
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const prompt = getSystemPrompt()

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="w-full px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button onClick={handleBack} variant="ghost" size="sm" className="p-1">
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Button>

              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {retellAgent.agent_name || 'Unnamed Agent'}
                  </h1>
                  {isConnected ? (
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 text-xs">
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
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {agentId.slice(0, 8)}...
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Updated {formatDate(retellAgent.last_modification_timestamp)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => window.open(`https://dashboard.retellai.com/agent/${retellAgent.agent_id}`, '_blank')}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Open in Retell
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-2 p-2 overflow-hidden">

        {/* Left — System Prompt */}
        <div className="w-2/3 flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">System Prompt</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {retellAgent.response_engine?.type === 'custom-llm'
                        ? 'Custom LLM'
                        : `${prompt.length.toLocaleString()} characters • ~${Math.ceil(prompt.length / 4)} tokens`}
                    </p>
                  </div>
                </div>
                {retellAgent.response_engine?.type !== 'custom-llm' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(prompt, 'prompt')}
                    className="text-xs border-gray-300 dark:border-gray-600"
                  >
                    {copied === 'prompt' ? (
                      <><CheckCircle className="w-3 h-3 mr-1" />Copied</>
                    ) : (
                      <><Copy className="w-3 h-3 mr-1" />Copy</>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Textarea
                value={prompt}
                disabled
                className="w-full h-full border-0 resize-none font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus-visible:ring-0"
                style={{ fontSize: '13px', lineHeight: '1.5' }}
              />
            </div>
          </div>
        </div>

        {/* Right — Config Sidebar */}
        <div className="w-1/3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-8">

            {/* Connection Status */}
            <div>
              <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
                Configuration Overview
              </h3>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span className={`text-sm font-medium ${isConnected ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {isConnected ? 'Webhook connected' : 'Webhook not configured'}
                </span>
              </div>
            </div>

            {/* Voice */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Mic className="w-3 h-3" /> Voice
                  </span>
                  <span className="text-xs text-gray-400">{retellAgent.voice_model || '—'}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {retellAgent.voice_id || '—'}
                </p>
              </div>

              {/* LLM */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Brain className="w-3 h-3" /> LLM
                  </span>
                  <span className="text-xs text-gray-400">{retellAgent.response_engine?.type}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {retellLlm?.model || retellAgent.response_engine?.llm_id || 'Custom LLM'}
                </p>
              </div>

              {/* Language */}
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Language</span>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {retellAgent.language || 'en-US'}
                </p>
              </div>

              {/* Retell Agent ID */}
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Retell Agent ID</span>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                    {retellAgent.agent_id}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 flex-shrink-0"
                    onClick={() => copyToClipboard(retellAgent.agent_id, 'agentId')}
                  >
                    {copied === 'agentId'
                      ? <CheckCircle className="w-3 h-3 text-green-500" />
                      : <Copy className="w-3 h-3 text-gray-400" />}
                  </Button>
                </div>
              </div>

              {/* Version */}
              {retellAgent.version !== undefined && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Version</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">v{retellAgent.version}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RetellDashboard