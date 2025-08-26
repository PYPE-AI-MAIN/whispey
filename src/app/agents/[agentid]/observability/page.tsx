// src/app/agents/[agentId]/observability/page.tsx
"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import TracesTable from "@/components/observabilty/TracesTable"
import ObservabilityFilters from "@/components/observabilty/ObservabilityFilters"
import { useState, use } from "react"

interface ObservabilityPageProps {
  params: Promise<{ agentId: string }>
  searchParams?: Promise<{ session_id?: string }>
}

export default function ObservabilityPage({ params, searchParams }: ObservabilityPageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const resolvedSearchParams = use(searchParams || Promise.resolve({} as { session_id?: string }))
  
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    timeRange: "24h"
  })

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
                  OpenTelemetry traces for agent {resolvedParams.agentId}
                  {resolvedSearchParams?.session_id && ` • Session ${resolvedSearchParams.session_id.slice(0, 8)}...`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <ObservabilityFilters
        filters={filters}
        onFiltersChange={setFilters}
        agentId={resolvedParams.agentId}
        sessionId={resolvedSearchParams?.session_id}
      />

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <TracesTable
          agentId={resolvedParams.agentId}
          sessionId={resolvedSearchParams?.session_id}
          filters={filters}
        />
      </div>
    </div>
  )
}