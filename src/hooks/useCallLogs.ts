// hooks/useCallLogs.ts
'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CallLog } from '@/types/logs'

interface DistinctConfig {
  column: string
  jsonField?: string
  order: 'asc' | 'desc'
}

interface UseCallLogsOptions {
  agentId: string | undefined
  /** When set, loads via server route so tags can be redacted for viewers. */
  projectId?: string
  preDistinctFilters: any[]
  postDistinctFilters: any[]
  select?: string
  orderBy?: { column: string; ascending: boolean }
  distinctConfig?: DistinctConfig
  dateRange?: { from: string; to: string }
  enabled?: boolean
  refetchOnMount?: boolean
  refetchOnWindowFocus?: boolean
  staleTime?: number
  gcTime?: number
  userId?: string
  userEmail?: string
}

export const useCallLogs = ({
  agentId,
  projectId,
  preDistinctFilters = [],
  postDistinctFilters = [],
  select = '*',
  orderBy = { column: 'created_at', ascending: false },
  distinctConfig,
  dateRange,
  enabled = true,
  refetchOnMount = false,
  refetchOnWindowFocus = false,
  staleTime = 5 * 60 * 1000, // 5 minutes
  gcTime = 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  userId,
  userEmail
}: UseCallLogsOptions) => {
  const useServerRoute = Boolean(projectId)

  return useInfiniteQuery({
    queryKey: [
      'call-logs',
      useServerRoute ? 'server' : 'rpc',
      projectId ?? '',
      agentId ?? '',
      JSON.stringify(preDistinctFilters), 
      JSON.stringify(postDistinctFilters),
      select, 
      `${orderBy.column}-${orderBy.ascending}`,
      distinctConfig ? JSON.stringify(distinctConfig) : 'no-distinct',
      dateRange ? `${dateRange.from}-${dateRange.to}` : 'no-date-range',
      userId ?? 'no-user'
    ],
    
    initialPageParam: 0,
    
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      if (!agentId) throw new Error('Agent ID required')

      const limit = 50
      const offset = pageParam

      const rpcParamsWithUser = {
        p_agent_id: agentId,
        p_pre_distinct_filters: preDistinctFilters,
        p_post_distinct_filters: postDistinctFilters,
        p_select: select,
        p_order_by_column: orderBy.column,
        p_order_ascending: orderBy.ascending,
        p_limit: limit,
        p_offset: offset,
        p_distinct_column: distinctConfig?.column || null,
        p_distinct_json_field: distinctConfig?.jsonField || null,
        p_distinct_order: distinctConfig?.order || 'asc',
        p_date_from: dateRange?.from || null,
        p_date_to: dateRange?.to || null,
        p_user_clerk_id: userId || null,
        p_user_email: userEmail || null
      }

      if (useServerRoute && projectId) {
        const res = await fetch(`/api/projects/${projectId}/call-logs/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rpcParamsWithUser),
        })
        const json = (await res.json()) as { data?: CallLog[]; error?: string }
        if (!res.ok) {
          throw new Error(json.error || res.statusText)
        }
        return (json.data || []) as CallLog[]
      }

      let { data, error } = await supabase.rpc('get_call_logs_with_distinct', rpcParamsWithUser)

      if (error?.code === 'PGRST202') {
        const params13 = {
          p_agent_id: agentId,
          p_pre_distinct_filters: preDistinctFilters,
          p_post_distinct_filters: postDistinctFilters,
          p_select: select,
          p_order_by_column: orderBy.column,
          p_order_ascending: orderBy.ascending,
          p_limit: limit,
          p_offset: offset,
          p_distinct_column: distinctConfig?.column || null,
          p_distinct_json_field: distinctConfig?.jsonField || null,
          p_distinct_order: distinctConfig?.order || 'asc',
          p_date_from: dateRange?.from || null,
          p_date_to: dateRange?.to || null,
          p_user_clerk_id: userId || null,
          p_user_email: userEmail || null
        }

        let { data, error } = await supabase.rpc('get_call_logs_with_distinct', rpcParamsWithUser)

        if (error?.code === 'PGRST202') {
          const params13 = {
            p_agent_id: agentId,
            p_pre_distinct_filters: preDistinctFilters,
            p_post_distinct_filters: postDistinctFilters,
            p_select: select,
            p_order_by_column: orderBy.column,
            p_order_ascending: orderBy.ascending,
            p_limit: limit,
            p_offset: offset,
            p_distinct_column: distinctConfig?.column || null,
            p_distinct_json_field: distinctConfig?.jsonField || null,
            p_distinct_order: distinctConfig?.order || 'asc',
            p_date_from: dateRange?.from || null,
            p_date_to: dateRange?.to || null
          }
          const fallback = await supabase.rpc('get_call_logs_with_distinct', params13)
          if (fallback.error) {
            console.error('❌ RPC Error (15-param and 13-param fallback):', fallback.error)
            throw fallback.error
          }
          data = fallback.data
          error = null
        }
        const fallback = await supabase.rpc('get_call_logs_with_distinct', params13)
        if (fallback.error) {
          console.error('❌ RPC Error (15-param and 13-param fallback):', fallback.error)
          throw fallback.error
        }
        data = fallback.data
        error = null
      }

      if (error) {
        console.error('❌ RPC Error:', error)
        throw error
      }

      return (data || []) as unknown as CallLog[]
    },

    getNextPageParam: (lastPage: any, allPages: any[]) => {
      if (!lastPage || lastPage.length < 50) return undefined
      return allPages.length * 50
    },

    enabled: enabled && !!agentId,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    refetchOnMount
  })
}