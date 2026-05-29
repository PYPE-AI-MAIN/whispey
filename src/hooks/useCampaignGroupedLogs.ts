'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { CallLog } from '@/types/logs'
import type { FilterOperation } from '@/components/CallFilter'

export const CAMPAIGN_PAGE_SIZE = 50

interface UseCampaignGroupedLogsOptions {
  agentId: string | undefined
  campaignId: string | undefined
  filters?: FilterOperation[]
  enabled?: boolean
}

export const useCampaignGroupedLogs = ({
  agentId,
  campaignId,
  filters = [],
  enabled = true,
}: UseCampaignGroupedLogsOptions) => {
  const [currentPage, setCurrentPage] = useState(1)
  const offset = (currentPage - 1) * CAMPAIGN_PAGE_SIZE

  useEffect(() => { setCurrentPage(1) }, [campaignId])

  const queryEnabled = enabled && !!agentId && !!campaignId

  const filterKey = filters
    .filter(f => f.type === 'filter')
    .map(f => `${f.column}:${f.operation}:${(f as any).value}:${(f as any).jsonField ?? ''}`)
    .join('|')

  const { data: pageData, isLoading, isFetching, isPlaceholderData, error, refetch } =
    useQuery<CallLog[]>({
      queryKey: ['campaign-grouped-logs', agentId, campaignId, currentPage, filterKey],
      queryFn: async ({ signal }) => {
        const res = await fetch(`/api/agents/${agentId}/call-logs/campaign/grouped`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId, limit: CAMPAIGN_PAGE_SIZE, offset, filters }),
          signal,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || res.statusText)
        return json.data ?? []
      },
      enabled: queryEnabled,
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
    })

  const rows = pageData ?? []
  const isLastPage = rows.length < CAMPAIGN_PAGE_SIZE
  const isFirstPage = currentPage === 1
  const hasNextPage = !isLastPage

  // Derive call counts from sub_rows embedded in each grouped row (no separate counts query)
  const countsMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const row of rows) {
      const subLen = row.sub_rows?.length ?? 0
      if (subLen > 0) map[row.customer_number] = subLen + 1
    }
    return map
  }, [rows])

  // Auto-back if we land on an empty page (edge case: prev page had exactly 50 rows)
  useEffect(() => {
    if (!isLoading && pageData !== undefined && rows.length === 0 && currentPage > 1) {
      setCurrentPage(p => p - 1)
    }
  }, [isLoading, pageData, rows.length, currentPage])

  const goToNextPage = useCallback(() => {
    if (!isLastPage && !isFetching) setCurrentPage(p => p + 1)
  }, [isLastPage, isFetching])

  const goToPrevPage = useCallback(() => setCurrentPage(p => Math.max(1, p - 1)), [])

  const goToPage = useCallback((page: number) => {
    if (page >= 1) setCurrentPage(page)
  }, [])

  const resetPage = useCallback(() => setCurrentPage(1), [])

  return {
    rows,
    countsMap,
    currentPage,
    isFirstPage,
    isLastPage,
    hasNextPage,
    goToNextPage,
    goToPrevPage,
    goToPage,
    resetPage,
    isLoading,
    isFetchingNextPage: isFetching,
    isRefetching: isFetching && !!pageData,
    error: error?.message,
    refetch,
  }
}
