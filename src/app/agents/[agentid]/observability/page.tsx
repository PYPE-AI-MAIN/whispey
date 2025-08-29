// src/app/agents/[agentId]/observability/page.tsx
"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import TracesTable from "@/components/observabilty/TracesTable"
import ObservabilityFilters from "@/components/observabilty/ObservabilityFilters"
import { useState, use, useEffect } from "react"
import { extractS3Key } from "@/utils/s3"
import AudioPlayer from "@/components/AudioPlayer"
import { useSupabaseQuery } from "@/hooks/useSupabase"
import ObservabilityStats from "@/components/observabilty/ObservabilityStats"

interface ObservabilityPageProps {
  params: Promise<{ agentId: string }>
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
    : [{ column: "agent_id", operator: "eq", value: resolvedParams.agentId }]


  const { data: callData, loading: callLoading, error: callError } = useSupabaseQuery("pype_voice_call_logs", {
    select: "id, call_id, agent_id, recording_url, customer_number, call_started_at, call_ended_reason, duration_seconds, metadata",
    filters: queryFilters,
    orderBy: { column: "created_at", ascending: false },
    limit: 1
  })

  // Get the recording URL from the first call
  const recordingUrl = callData && callData.length > 0 ? callData[0].recording_url : null
  const callInfo = callData && callData.length > 0 ? callData[0] : null

  // Check if URL might be expired (for signed URLs)
  const isSignedUrl = recordingUrl && recordingUrl.includes('X-Amz-Signature')
  const isUrlExpired = isSignedUrl && recordingUrl.includes('X-Amz-Expires=604800') // 7 days

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Agent
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">Observability Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  {sessionId && `Session ${sessionId.slice(0, 8)}...`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Audio Player - show if we have a recording URL */}
      {recordingUrl && !callLoading && (
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Call Recording</h3>
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
        agentId={resolvedParams.agentId}
        sessionId={sessionId}
      /> */}

      <ObservabilityStats
        sessionId={sessionId}
        agentId={resolvedParams.agentId}
        callData={callData}
      />

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <TracesTable
          agentId={resolvedParams.agentId}
          sessionId={sessionId}
          filters={filters}
        />
      </div>
    </div>
  )
}