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
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-8 py-3">
            <div className="flex items-center">
              <div className="h-8 w-32 bg-red-100 rounded flex items-center justify-center">
                <span className="text-red-600 text-sm font-medium">Invalid Agent</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-md text-center">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Agent ID</h2>
            <p className="text-sm text-gray-500 mb-4">Agent ID missing or invalid</p>
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