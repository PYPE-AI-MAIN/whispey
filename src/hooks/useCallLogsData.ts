import { useState, useEffect, useMemo } from 'react'
import { getUserProjectRole } from "@/services/getUserRole"
import { toCamelCase, getSelectColumns, convertToSupabaseFilters } from '@/utils/callLogsUtils'
import { FilterRule } from '@/components/CallFilter'
import { useCallLogs } from "@/hooks/useCallLogs"

export const useCallLogsData = (
  agent: any,
  userEmail?: string,
  projectId?: string
) => {
  const [role, setRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])

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

  // Fetch call logs
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
    enabled: !!agent?.id && !roleLoading
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