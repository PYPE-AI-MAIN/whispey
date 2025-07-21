'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Dashboard from '@/components/Dashboard'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function AgentDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const [agentId, setAgentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Wait for params to be properly loaded
    if (params && params.agentid) {
      const id = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid
      setAgentId(id)
    }
    setIsLoading(false)
  }, [params])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!agentId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Invalid Agent ID</h2>
          <p className="text-gray-600 max-w-md">
            The agent ID in the URL is invalid or missing.
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