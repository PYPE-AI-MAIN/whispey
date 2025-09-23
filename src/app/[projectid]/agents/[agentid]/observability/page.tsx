// src/app/agents/[agentId]/observability/page.tsx
"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import TracesTable from "@/components/observabilty/TracesTable"
import { useState, use } from "react"
import { extractS3Key } from "@/utils/s3"
import AudioPlayer from "@/components/AudioPlayer"
import { useSupabaseQuery } from "@/hooks/useSupabase"
import ObservabilityStats from "@/components/observabilty/ObservabilityStats"

interface ObservabilityPageProps {
  params: Promise<{ agentid: string }>
  searchParams?: Promise<{ session_id?: string }>
}

export default function ObservabilityPage({ params, searchParams }: ObservabilityPageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const resolvedSearchParams = use(searchParams || Promise.resolve({} as { session_id?: string }))
  const sessionId = resolvedSearchParams?.session_id
  
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    timeRange: "24h"
  })

  // Build query filters based on whether we have sessionId or agentId
  const queryFilters = sessionId 
    ? [{ column: "id", operator: "eq", value: sessionId }]
    : [{ column: "agent_id", operator: "eq", value: resolvedParams.agentid }]


  const { data: callData, loading: callLoading, error: callError } = useSupabaseQuery("pype_voice_call_logs", {
    select: "id, call_id, agent_id, recording_url, customer_number, call_started_at, call_ended_reason, duration_seconds, metadata",
    filters: queryFilters,
    orderBy: { column: "created_at", ascending: false },
    limit: 1
  })

  const { data: agentData, loading: agentLoading, error: agentError } = useSupabaseQuery("pype_voice_agents", {
    select: "id, name, agent_type, configuration, vapi_api_key_encrypted, vapi_project_key_encrypted",
    filters: [{ column: "id", operator: "eq", value: resolvedParams.agentid }],
    limit: 1
  })

  const agent = agentData && agentData.length > 0 ? agentData[0] : null

  // Get the recording URL from the first call
  const recordingUrl = callData && callData.length > 0 ? callData[0].recording_url : null
  const callInfo = callData && callData.length > 0 ? callData[0] : null

  // Check if URL might be expired (for signed URLs)
  const isSignedUrl = recordingUrl && recordingUrl.includes('X-Amz-Signature')
  const isUrlExpired = isSignedUrl && recordingUrl.includes('X-Amz-Expires=604800') // 7 days

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      

      {/* Audio Player - show if we have a recording URL */}
      {recordingUrl && !callLoading && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Call Recording</h3>
          <AudioPlayer
            s3Key={extractS3Key(recordingUrl)}
            url={recordingUrl}
            callId={callInfo?.id}
          />
        </div>
      )}

      {/* Filters */}
      {/* <ObservabilityFilters
        filters={filters}
        onFiltersChange={setFilters}
        agentId={resolvedParams.agentid}
        sessionId={sessionId}
      /> */}

      {agentLoading ? (
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
          <div className="animate-pulse text-gray-600 dark:text-gray-400">Loading agent data...</div>
        </div>
      ) : (
        <ObservabilityStats
          sessionId={sessionId}
          agentId={resolvedParams.agentid}
          callData={callData}
          agent={agent}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <TracesTable
          agentId={resolvedParams.agentid}
          sessionId={sessionId}
          agent={agent}
          filters={filters}
        />
      </div>
    </div>
  )
}