// src/app/[projectid]/agents/[agentid]/retell/page.tsx
// Mirrors the Vapi dashboard page at /[projectid]/agents/[agentid]/vapi/page.tsx

'use client'

import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import RetellDashboard from '@/components/agents/RetellDashboard'
import { Loader2 } from 'lucide-react'

function RetellDashboardContent() {
  const params = useParams()
  const agentId = Array.isArray(params?.agentid) ? params.agentid[0] : params.agentid

  if (!agentId) {
    return <div className="flex items-center justify-center h-screen text-red-500">Invalid agent ID</div>
  }

  return <RetellDashboard agentId={agentId} />
}

export default function RetellDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    }>
      <RetellDashboardContent />
    </Suspense>
  )
}