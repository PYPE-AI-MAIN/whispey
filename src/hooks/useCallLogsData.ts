import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getUserProjectRole } from "@/services/getUserRole"
import { getSelectColumns, extractFiltersAndDistinct, isViewerRole } from '@/utils/callLogsUtils'
import { FilterOperation } from '@/components/CallFilter'
import { useCallLogs, buildCallLogsQueryKey, PAGE_SIZE } from "@/hooks/useCallLogs"
import { useCallLogsStore } from '@/stores/callLogsStore'

const EMPTY_FILTERS: FilterOperation[] = []

export { PAGE_SIZE }

export const useCallLogsData = (
  agent: any,
  userEmail?: string,
  projectId?: string,
  dateRange?: { from: string; to: string },
  userId?: string
) => {
  const [role, setRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  const agentId = agent?.id as string | undefined

  const {
    filtersByAgent, setFiltersForAgent,
    pageByAgent, setPageForAgent,
  } = useCallLogsStore()

  const activeFilters: FilterOperation[] = (agentId ? filtersByAgent[agentId] : undefined) ?? EMPTY_FILTERS

  // Current page from persisted Zustand store
  const currentPage: number = (agentId ? pageByAgent[agentId] : undefined) ?? 1

  // Read current page from store at call time — no stale closure, no currentPage dep.
  // This keeps setCurrentPage stable (only changes when agentId changes), preventing
  // cascade re-renders in every callback that depends on it.
  const setCurrentPage = useCallback(
    (pageOrFn: number | ((prev: number) => number)) => {
      if (!agentId) return
      const current = useCallLogsStore.getState().pageByAgent[agentId] ?? 1
      const next = typeof pageOrFn === 'function' ? pageOrFn(current) : pageOrFn
      useCallLogsStore.getState().setPageForAgent(agentId, Math.max(1, next))
    },
    [agentId]  // stable — doesn't recreate on every page change
  )

  const setActiveFilters = useCallback(
    (operations: FilterOperation[]) => {
      if (agentId) setFiltersForAgent(agentId, operations)
    },
    [agentId, setFiltersForAgent]
  )

  const { preDistinctFilters, postDistinctFilters, distinctConfig } = useMemo(
    () => extractFiltersAndDistinct(activeFilters, agentId),
    [activeFilters, agentId]
  )

  useEffect(() => {
    if ((userEmail || userId) && projectId) {
      const getUserRole = async () => {
        setRoleLoading(true)
        try {
          const userRole = await getUserProjectRole(userEmail ?? '', projectId, userId)
          setRole(userRole.role)
        } catch {
          setRole('user')
        } finally {
          setRoleLoading(false)
        }
      }
      getUserRole()
    } else {
      setRoleLoading(false)
      setRole('user')
    }
  }, [userEmail, projectId, userId])

  useEffect(() => {
    if (!agentId || !isViewerRole(role)) return
    const next = activeFilters.filter(
      op => !(op.type === 'filter' && op.column === 'tags')
    )
    if (next.length === activeFilters.length) return
    setActiveFilters(next)
  }, [role, agentId, activeFilters, setActiveFilters])

  const selectColumns = useMemo(() => getSelectColumns(role), [role])

  // Reset to page 1 when agent / filters / dates change
  const filterKey = JSON.stringify(activeFilters)
  const prevQueryKeyRef = useRef<string>('')
  useEffect(() => {
    const key = `${agentId}|${filterKey}|${dateRange?.from}|${dateRange?.to}`
    if (prevQueryKeyRef.current && prevQueryKeyRef.current !== key) {
      setCurrentPage(1)
    }
    prevQueryKeyRef.current = key
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, filterKey, dateRange?.from, dateRange?.to])

  // ── Per-page query (direct offset fetch — no sequential loading) ──────────
  const queryEnabled = !!agentId && !roleLoading
  const {
    data: pageData,
    isLoading,
    isFetching,
    isPlaceholderData,
    error: queryError,
    refetch: rawRefetch,
  } = useCallLogs({
    agentId,
    projectId,
    preDistinctFilters,
    postDistinctFilters,
    select: selectColumns,
    distinctConfig,
    dateRange,
    page: currentPage,
    enabled: queryEnabled,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    userId,
    userEmail,
  })

  // Stable reference: when pageData is undefined (loading), always return the same []
  // so downstream useMemos that depend on calls don't recompute every render.
  const currentPageCalls = useMemo(() => pageData ?? [], [pageData])

  // ── Total count (HEAD query — no rows transferred) ────────────────────────
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['call-logs-count', agentId, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dateRange?.from) params.set('dateFrom', dateRange.from)
      if (dateRange?.to)   params.set('dateTo',   dateRange.to)
      const res = await fetch(`/api/agents/${agentId}/call-logs/count?${params}`)
      if (!res.ok) throw new Error('count fetch failed')
      return res.json()
    },
    enabled: queryEnabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Suppress totalCount when filters are active — count doesn't reflect filtered results
  const totalCount: number | null =
    activeFilters.length === 0 ? (countData?.count ?? null) : null

  const totalPages = totalCount !== null ? Math.ceil(totalCount / PAGE_SIZE) : null

  // Whether the current page is the last one (no more data).
  // Use pageData?.length (stable — only changes when real data arrives) instead of
  // isFetching (flips rapidly with keepPreviousData and would cause effect loops).
  const isLastPage = totalPages !== null
    ? currentPage >= totalPages
    : ((pageData?.length ?? PAGE_SIZE) < PAGE_SIZE)

  const hasNextPage = !isLastPage

  const isFirstPage = currentPage === 1

  // ── Prefetch next page for instant navigation ─────────────────────────────
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!agentId || !queryEnabled || isLastPage) return
    const nextPage = currentPage + 1
    const nextKey = buildCallLogsQueryKey(
      projectId ?? '',
      agentId,
      preDistinctFilters,
      postDistinctFilters,
      selectColumns,
      { column: 'created_at', ascending: false },
      distinctConfig,
      dateRange,
      userId ?? 'no-user',
      nextPage,
    )
    queryClient.prefetchQuery({
      queryKey: nextKey,
      queryFn: async ({ signal }) => {
        const body = {
          p_agent_id: agentId,
          p_pre_distinct_filters: preDistinctFilters,
          p_post_distinct_filters: postDistinctFilters,
          p_select: selectColumns,
          p_order_by_column: 'created_at',
          p_order_ascending: false,
          p_limit: PAGE_SIZE,
          p_offset: nextPage * PAGE_SIZE - PAGE_SIZE,
          p_distinct_column: distinctConfig?.column || null,
          p_distinct_json_field: distinctConfig?.jsonField || null,
          p_distinct_order: distinctConfig?.order || 'asc',
          p_date_from: dateRange?.from || null,
          p_date_to: dateRange?.to || null,
          p_user_clerk_id: userId || null,
          p_user_email: userEmail || null,
        }
        const url = projectId
          ? `/api/projects/${projectId}/call-logs/query`
          : `/api/agents/${agentId}/call-logs/query`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || res.statusText)
        return json.data || []
      },
      staleTime: 5 * 60 * 1000,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, agentId, isLastPage])

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToNextPage = useCallback(() => {
    if (!isLastPage) setCurrentPage(p => p + 1)
  }, [isLastPage, setCurrentPage])

  const goToPrevPage = useCallback(() => {
    setCurrentPage(p => Math.max(1, p - 1))
  }, [setCurrentPage])

  const goToPage = useCallback((page: number) => {
    if (page >= 1) setCurrentPage(page)
  }, [setCurrentPage])

  // Refresh: reset to page 1 and re-fetch
  const refetch = useCallback(async () => {
    setCurrentPage(1)
    await rawRefetch()
  }, [rawRefetch, setCurrentPage])

  // `calls` = all data visible to column/tag detectors (current page)
  const calls = currentPageCalls

  return {
    calls,
    currentPageCalls,
    currentPage,
    setCurrentPage,
    totalCount,
    totalPages,
    isFirstPage,
    isLastPage,
    hasNextPage,
    goToNextPage,
    goToPrevPage,
    goToPage,
    role,
    roleLoading,
    isLoading,
    isFetchingNextPage: isFetching && !isPlaceholderData,
    isRefetching: isFetching && !!pageData,
    error: queryError?.message,
    activeFilters,
    setActiveFilters,
    refetch,
  }
}
