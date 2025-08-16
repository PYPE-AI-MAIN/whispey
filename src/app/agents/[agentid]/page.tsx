// src/app/agents/[agentid]/page.tsx
'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Dashboard from '@/components/Dashboard'
import VapiDashboard from '@/components/agents/VapiDashboard'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface AgentData {
  id: string
  name: string
  agent_type: string
  project_id: string
  vapi_api_key_encrypted?: string
  vapi_project_key_encrypted?: string
  configuration: any
}

function AgentDashboardContent() {
  const params = useParams()
  const router = useRouter()
  const [agentId, setAgentId] = useState<string | null>(null)
  const [agentData, setAgentData] = useState<AgentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isVapiAgent, setIsVapiAgent] = useState(false)

  useEffect(() => {
    const fetchAgentData = async () => {
      if (!params?.agentid) return

      const id = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid
      setAgentId(id)
      setIsLoading(true)
      setError(null)

      try {
        console.log('🔍 Fetching agent data for ID:', id)

        // Fetch agent data from your database
        const response = await fetch(`/api/agents/${id}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch agent')
        }

        const data = await response.json()
        console.log('📊 Agent data received:', data)

        setAgentData(data)

        const hasVapiKeys = Boolean(data.vapi_api_key_encrypted && data.vapi_project_key_encrypted)
        const hasVapiConfig = Boolean(data.configuration?.vapi?.assistantId)
        const isVapi = hasVapiKeys || hasVapiConfig || data.agent_type === 'vapi'

        console.log('🤖 Agent type detection:', {
          agent_type: data.agent_type,
          hasVapiKeys,
          hasVapiConfig,
          isVapi,
          configuration: data.configuration
        })

        setIsVapiAgent(isVapi)

      } catch (err) {
        console.error('❌ Error fetching agent:', err)
        setError(err instanceof Error ? err.message : 'Failed to load agent')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAgentData()
  }, [params])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading agent data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Error Loading Agent</h2>
          <p className="text-gray-600">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Button variant="outline" onClick={() => router.push('/')}>
              Go Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!agentId || !agentData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Agent Not Found</h2>
          <p className="text-gray-600 max-w-md">
            The requested agent could not be found or you don't have access to it.
          </p>
          <Button variant="outline" onClick={() => router.push('/')}>
            Go Home
          </Button>
        </div>
      </div>
    )
  }

    return <Dashboard agentId={agentId} />
}

export default function AgentDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AgentDashboardContent />
    </Suspense>
  )
}