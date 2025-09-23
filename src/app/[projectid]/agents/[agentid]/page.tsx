// src/app/[projectid]/agents/[agentid]/page.tsx
'use client'
import { useParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import Dashboard from '@/components/Dashboard'
import { AlertCircle, Loader2 } from 'lucide-react'

// Simple skeleton for the dashboard shell
function DashboardSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header skeleton - matches your existing header structure */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-8 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Navigation & Identity skeleton */}
            <div className="flex items-center gap-6">
              <div className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl">
                <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Agent name skeleton */}
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
                {/* Badge skeleton */}
                <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>
              </div>

              {/* Tab navigation skeleton */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 ml-8">
                <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            </div>

            {/* Right: Controls skeleton */}
            <div className="flex items-center gap-6">
              {/* Period filters skeleton */}
              <div className="flex items-center gap-4">
                <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <div className="h-8 w-10 bg-gray-200 rounded-md animate-pulse"></div>
                  <div className="h-8 w-10 bg-gray-200 rounded-md animate-pulse"></div>
                  <div className="h-8 w-12 bg-gray-200 rounded-md animate-pulse"></div>
                </div>
                <div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
              <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Content area skeleton */}
      <div className="flex-1 p-6">
        <div className="space-y-4">
          {/* Content skeleton */}
          <div className="h-48 w-full bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-64 w-full bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}

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
    <Suspense fallback={<DashboardSkeleton />}>
      <AgentDashboardContent />
    </Suspense>
  )
}