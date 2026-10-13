// src/app/[projectid]/agents/[agentid]/page.tsx
'use client'
import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import Dashboard from '@/components/Dashboard'
import { AlertCircle } from 'lucide-react'

function AgentDashboardContent() {
  const params = useParams()  
  const agentId = Array.isArray(params?.agentid) ? params.agentid[0] : params.agentid
  

  // Validate agentId immediately - no loading needed
  if (!agentId || agentId === 'undefined' || agentId.trim() === '') {
    return (
      <div className="h-screen flex flex-col bg-muted/50">
        <div className="bg-card border-b border-border shadow-sm">
          <div className="px-8 py-3">
            <div className="flex items-center">
              <div className="h-8 w-32 bg-red-100 dark:bg-red-900/20 rounded-md flex items-center justify-center">
                <span className="text-red-600 dark:text-red-400 text-sm font-medium">Invalid Agent</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="rounded-xl border border-border bg-card shadow-sm p-6 max-w-md text-center">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Invalid Agent ID</h2>
            <p className="text-sm text-muted-foreground mb-4">Agent ID missing or invalid</p>
          </div>
        </div>
      </div>
    )
  }

  // Pass agentId to Dashboard - let Dashboard handle the data fetching
  return <Dashboard agentId={agentId} />
}

export default function AgentDashboardPage() {
  return (
    <Suspense fallback={null}>
      <AgentDashboardContent />
    </Suspense>
  )
}