import { useState, useEffect, useMemo } from 'react'
import { getUserProjectRole } from "@/services/getUserRole"
import { toCamelCase, getSelectColumns, convertToSupabaseFilters } from '@/utils/callLogsUtils'
import { FilterRule } from '@/components/CallFilter'
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
  const { activeFilters, setActiveFilters, distinctConfig } = useCallLogsStore()

  // Backward compatibility: Clean invalid filters on mount
  useEffect(() => {
    const jsonbColumns = ['metadata', 'transcription_metrics']
    const jsonbOperations = ['json_equals', 'json_contains', 'json_greater_than', 'json_less_than', 'json_exists']
    
    const invalidFilters = activeFilters.filter(filter => {
      if (jsonbColumns.includes(filter.column) && jsonbOperations.includes(filter.operation)) {
        return !filter.jsonField
      }
      return false
    })
    
    if (invalidFilters.length > 0) {
      // Remove invalid filters
      const validFilters = activeFilters.filter(filter => {
        if (jsonbColumns.includes(filter.column) && jsonbOperations.includes(filter.operation)) {
          return !!filter.jsonField
        }
        return true
      })
      setActiveFilters(validFilters)
      console.warn(`Removed ${invalidFilters.length} invalid filter(s) missing jsonField`)
    }
  }, []) // Only run once on mount

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

  // Memoize supabase filters
  const supabaseFilters = useMemo(
    () => convertToSupabaseFilters(activeFilters, agent?.id),
    [activeFilters, agent?.id]
  )

  // Fetch call logs with cache optimization
  const { 
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error: queryError,
    fetchNextPage,
    refetch 
  } = useCallLogs({
    agentId: agent?.id,
    filters: supabaseFilters,
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
    isLoading: isLoading || isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: queryError?.message,
    activeFilters,
    setActiveFilters,
    fetchNextPage,
    refetch
  }
}