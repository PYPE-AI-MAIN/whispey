// src/app/agents/[agentid]/vapi/page.tsx
import React from 'react'
import VapiDashboard from '@/components/agents/VapiDashboard'

async function VapiAgentDashboard({ params }: { params: Promise<{ agentid: string }> }) {
  const { agentid } = await params
  
  
  return (
    <VapiDashboard agentId={agentid} />
  )
}

export default VapiAgentDashboard