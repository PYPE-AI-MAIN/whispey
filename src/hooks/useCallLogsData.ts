import { useState, useEffect, useMemo, useCallback } from 'react'
import { getUserProjectRole } from "@/services/getUserRole"
import { toCamelCase, getSelectColumns, extractFiltersAndDistinct } from '@/utils/callLogsUtils'
import { FilterOperation } from '@/components/CallFilter'
import { useCallLogs } from "@/hooks/useCallLogs"
import { useCallLogsStore } from '@/stores/callLogsStore'

// Stable reference so CallFilter's useEffect([initialFilters]) doesn't
// fire on every render when this agent has no stored filters yet.
const EMPTY_FILTERS: FilterOperation[] = []

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

  // Read this agent's filters from the per-agent store slot
  const { filtersByAgent, setFiltersForAgent } = useCallLogsStore()
  const activeFilters: FilterOperation[] = (agentId ? filtersByAgent[agentId] : undefined) ?? EMPTY_FILTERS

  // Agent-scoped setter — writes only to this agent's slot
  const setActiveFilters = useCallback(
    (operations: FilterOperation[]) => {
      if (agentId) setFiltersForAgent(agentId, operations)
    },
    [agentId, setFiltersForAgent]
  )

  // Extract filters and distinct config from the unified operations array
  const { preDistinctFilters, postDistinctFilters, distinctConfig } = useMemo(
    () => extractFiltersAndDistinct(activeFilters, agentId),
    [activeFilters, agentId]
  )

  // Fetch user role (use clerk_id when available so owners/members added by clerk_id are found)
  useEffect(() => {
    if ((userEmail || userId) && projectId) {
      const getUserRole = async () => {
        setRoleLoading(true)
        try {
          const userRole = await getUserProjectRole(userEmail ?? '', projectId, userId)
          setRole(userRole.role)
        } catch (error) {
          console.error('Failed to load user role:', error)
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

  const selectColumns = useMemo(() => getSelectColumns(role), [role])

  const {
    data,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    hasNextPage,
    error: queryError,
    fetchNextPage,
    refetch
  } = useCallLogs({
    agentId,
    preDistinctFilters,
    postDistinctFilters,
    select: selectColumns,
    distinctConfig,
    dateRange,
    enabled: !!agentId && !roleLoading,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  })

  const calls = useMemo(() => data?.pages.flat() ?? [], [data])

  return {
    calls,
    role,
    roleLoading,
    isLoading: isLoading || isFetchingNextPage,
    isRefetching: isRefetching ?? false,
    hasNextPage: hasNextPage ?? false,
    error: queryError?.message,
    activeFilters,
    setActiveFilters,
    fetchNextPage,
    refetch
  }
}
