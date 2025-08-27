// src/components/calls/ObservabilityButton.tsx
"use client"

import { Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface ObservabilityButtonProps {
  sessionId: string
  agentId?: string
}

const ObservabilityButton: React.FC<ObservabilityButtonProps> = ({ sessionId, agentId }) => {
  const router = useRouter()

  const handleClick = () => {
    // Extract agent ID from session ID if not provided
    const targetAgentId = agentId || sessionId.split('-')[0] || sessionId
    
    // Navigate to observability page with session_id as query param
    router.push(`/agents/${targetAgentId}/observability?session_id=${sessionId}`)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Activity className="w-4 h-4 mr-2" />
      Traces
    </Button>
  )
}

export default ObservabilityButton