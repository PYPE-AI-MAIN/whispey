'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Workflow, ArrowRight, MoreVertical, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCampaignFlows } from '@/hooks/useCampaignFlows'
import type { CampaignFlowSummary } from '@/lib/campaignFlows/types'

export default function CampaignFlowsPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectid as string
  const { data: campaignFlows = [] } = useCampaignFlows(projectId)
  const queryClient = useQueryClient()
  const [renamingFlowId, setRenamingFlowId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const invalidateCampaignFlows = () => queryClient.invalidateQueries({ queryKey: ['campaign-flows', projectId] })

  const startRenameFlow = (flow: CampaignFlowSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingFlowId(flow.flowId)
    setRenameValue(flow.name)
  }

  const commitRenameFlow = async (flowId: string) => {
    const trimmed = renameValue.trim()
    setRenamingFlowId(null)
    if (!trimmed) return
    await fetch(`/api/campaign-flows/${flowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    invalidateCampaignFlows()
  }

  const deleteFlow = async (flowId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this campaign flow? This cannot be undone.')) return
    await fetch(`/api/campaign-flows/${flowId}`, { method: 'DELETE' })
    invalidateCampaignFlows()
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-100 dark:bg-violet-900/20">
              <Workflow className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Campaign Flows</h1>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium rounded-full shrink-0">Beta</Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Reusable, multi-step designs a contact can be run through
                <span className="text-gray-400 dark:text-gray-500"> · {campaignFlows.length} total</span>
              </p>
            </div>
          </div>
          <Button onClick={() => router.push(`/${projectId}/campaigns/flows/create`)} size="sm" className="h-7 text-xs gap-1.5">
            <Plus className="w-3 h-3" />
            Create Campaign Flow
          </Button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-4">
        {campaignFlows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/20 rounded-full flex items-center justify-center mb-3">
              <Workflow className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              No campaign flows yet
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-xs">
              Design a multi-step, multi-channel sequence a contact can be run through.
            </p>
            <Button onClick={() => router.push(`/${projectId}/campaigns/flows/create`)} size="sm" className="h-7 text-xs gap-2">
              <Plus className="w-3 h-3" />
              Create Campaign Flow
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {campaignFlows.map((flow) => (
              <div
                key={flow.flowId}
                onClick={() => router.push(`/${projectId}/campaigns/flows/${flow.flowId}`)}
                className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                  rounded-lg p-4 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-sm
                  transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      {renamingFlowId === flow.flowId ? (
                        <Input
                          autoFocus
                          value={renameValue}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => commitRenameFlow(flow.flowId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRenameFlow(flow.flowId)
                            if (e.key === 'Escape') setRenamingFlowId(null)
                          }}
                          className="h-6 max-w-xs text-sm font-semibold"
                        />
                      ) : (
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {flow.name}
                        </h3>
                      )}
                      <Badge variant="outline" className="text-xs shrink-0">
                        {flow.status === 'live' ? 'Live' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{flow.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                      Open in builder <ArrowRight className="w-3 h-3" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => startRenameFlow(flow, e)}>Rename</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => deleteFlow(flow.flowId, e)} className="text-red-600 dark:text-red-400">
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
