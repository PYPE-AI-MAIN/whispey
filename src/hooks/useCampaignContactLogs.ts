'use client'

import { useQuery } from '@tanstack/react-query'
import type { CallLog } from '@/types/logs'

interface UseCampaignContactLogsOptions {
  agentId: string | undefined
  campaignId: string | undefined
  customerNumber: string | undefined
  enabled?: boolean
}

export const useCampaignContactLogs = ({
  agentId,
  campaignId,
  customerNumber,
  enabled = true,
}: UseCampaignContactLogsOptions) => {
  return useQuery<CallLog[]>({
    queryKey: ['campaign-contact-logs', agentId, campaignId, customerNumber],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        campaignId: campaignId!,
        customerNumber: customerNumber!,
      })
      const res = await fetch(
        `/api/agents/${agentId}/call-logs/campaign/contact?${params}`,
        { signal }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      return json.data ?? []
    },
    enabled: enabled && !!agentId && !!campaignId && !!customerNumber,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
