'use client'

import { useQuery } from '@tanstack/react-query'
import type { CampaignCounts, ImportStatus, StatusCounts } from '@/types/campaignScheduler'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(String(res.status))
  return res.json() as Promise<T>
}

/**
 * Status counts for every campaign on the page in ONE request.
 * Optional: when the scheduler does not support it the list keeps its own `callStats`.
 */
export function useCampaignCounts(projectId: string, ids: string[]) {
  const key = ids.join(',')
  return useQuery<Record<string, StatusCounts> | undefined>({
    queryKey: ['campaign-counts', projectId, key],
    queryFn: async () =>
      (await getJson<CampaignCounts>(`/api/campaigns/counts?projectId=${encodeURIComponent(projectId)}&ids=${encodeURIComponent(key)}`)).counts,
    enabled: !!projectId && ids.length > 0,
    retry: false,
    staleTime: 30_000,
  })
}

/** location 'customer' when the project's contacts live in the customer's environment; destination is its name. */
export function useCampaignStorage(projectId: string) {
  return useQuery<{ location: 'pype' | 'customer'; destination?: string | null }>({
    queryKey: ['campaign-location', projectId],
    queryFn: () => getJson(`/api/campaigns/location?projectId=${encodeURIComponent(projectId)}`),
    enabled: !!projectId,
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export const useCampaignLocation = (projectId: string) => {
  const q = useCampaignStorage(projectId)
  return { ...q, data: q.data?.location }
}

/** Import progress and rejected rows; polls while processing. Optional: undefined when unsupported. */
export function useCampaignImport(campaignId: string) {
  return useQuery<ImportStatus>({
    queryKey: ['campaign-import', campaignId],
    queryFn: () => getJson<ImportStatus>(`/api/campaigns/import-status?campaignId=${encodeURIComponent(campaignId)}`),
    enabled: !!campaignId,
    retry: false,
    refetchInterval: (q) => (q.state.data?.status === 'processing' ? 3000 : false),
  })
}
