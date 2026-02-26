import { useState, useEffect, useMemo } from 'react'
import { getUserProjectRole } from "@/services/getUserRole"
import { toCamelCase, getSelectColumns, extractFiltersAndDistinct } from '@/utils/callLogsUtils'
import { FilterOperation } from '@/components/CallFilter'
import { useCallLogs } from "@/hooks/useCallLogs"
import { useCallLogsStore } from '@/stores/callLogsStore'

export const useCallLogsData = (
  agent: any,
  userEmail?: string,
  projectId?: string,
  dateRange?: { from: string; to: string }
) => {
  const [role, setRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const { activeFilters, setActiveFilters, distinctConfig: legacyDistinctConfig } = useCallLogsStore()

  // Extract filters and distinct config from operations
  const { preDistinctFilters, postDistinctFilters, distinctConfig: extractedDistinctConfig } = useMemo(
    () => extractFiltersAndDistinct(activeFilters, agent?.id),
    [activeFilters, agent?.id]
  )
  
  // Use extracted distinct config, fallback to legacy if not found
  const distinctConfig = extractedDistinctConfig || legacyDistinctConfig

  // Fetch user role
  useEffect(() => {
    if (userEmail && projectId) {
      const getUserRole = async () => {
        setRoleLoading(true)
        try {
          const userRole = await getUserProjectRole(userEmail, projectId)
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
  }, [userEmail, projectId])

  // Memoize select columns
  const selectColumns = useMemo(() => getSelectColumns(role), [role])

  // Fetch call logs with cache optimization
  const { 
    data,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    error: queryError,
    fetchNextPage,
    refetch 
  } = useCallLogs({
    agentId: agent?.id,
    preDistinctFilters: preDistinctFilters,
    postDistinctFilters: postDistinctFilters,
    select: selectColumns,
    distinctConfig: distinctConfig,
    dateRange: dateRange,
    enabled: !!agent?.id && !roleLoading,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  })

  const calls = useMemo(() => data?.pages.flat() ?? [], [data])

  return {
    calls,
    role,
    roleLoading,
    isLoading: isLoading || isRefetching || isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: queryError?.message,
    activeFilters,
    setActiveFilters,
    fetchNextPage,
    refetch
  }
}