'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { Campaign } from '@/utils/campaigns/constants'

export interface CampaignPagination {
  total:       number
  totalPages:  number
  currentPage: number
  hasMore:     boolean
  limit:       number
}

export interface CampaignListResponse {
  campaigns:  Campaign[]
  pagination: CampaignPagination
  count:      number
}

interface UseCampaignsOptions {
  projectId: string
  page:      number   // 1-based
  pageSize?: number
  search?:   string
  enabled?:  boolean
}

export const useCampaigns = ({
  projectId,
  page,
  pageSize = 10,
  search   = '',
  enabled  = true,
}: UseCampaignsOptions) => {
  return useQuery<CampaignListResponse>({
    queryKey: ['campaigns', projectId, page, pageSize, search],

    queryFn: async () => {
      const params = new URLSearchParams({
        projectId,
        page:  String(page),
        limit: String(pageSize),
      })
      if (search.trim()) params.set('search', search.trim())

      const res  = await fetch(`/api/campaigns/list?${params.toString()}`)
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Failed to fetch campaigns')

      // Normalize: backend wraps in { campaigns, pagination } already
      return json as CampaignListResponse
    },

    placeholderData: keepPreviousData,  // keeps old page visible while next page loads
    staleTime:       30 * 1000,         // 30 s
    enabled:         enabled && !!projectId,
  })
}
