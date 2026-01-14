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
}

export const useCallLogs = ({
  agentId,
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
  gcTime = 10 * 60 * 1000 // 10 minutes (formerly cacheTime)
}: UseCallLogsOptions) => {
  return useInfiniteQuery({
    queryKey: [
      'call-logs', 
      agentId ?? '',
      JSON.stringify(preDistinctFilters), 
      JSON.stringify(postDistinctFilters),
      select, 
      `${orderBy.column}-${orderBy.ascending}`,
      distinctConfig ? JSON.stringify(distinctConfig) : 'no-distinct',
      dateRange ? `${dateRange.from}-${dateRange.to}` : 'no-date-range'
    ],
    
    initialPageParam: 0,
    
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      if (!agentId) throw new Error('Agent ID required')

      const limit = 50
      const offset = pageParam

      // Use RPC function for all queries (handles filters correctly)
      // Always use RPC to ensure consistent filter handling
      if (true) {
        const rpcParams = {
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
        
        console.log('🔍 RPC Call - Parameters:', JSON.stringify(rpcParams, null, 2))
        console.log('🔍 Pre-distinct filters:', JSON.stringify(preDistinctFilters, null, 2))
        console.log('🔍 Post-distinct filters:', JSON.stringify(postDistinctFilters, null, 2))
        console.log('🔍 OrderBy column:', orderBy.column)
        console.log('🔍 Distinct config:', JSON.stringify(distinctConfig, null, 2))
        
        const { data, error } = await supabase.rpc('get_call_logs_with_distinct', rpcParams)

        if (error) {
          console.error('❌ RPC Error:', error)
          console.error('❌ Error details:', JSON.stringify(error, null, 2))
          throw error
        }
        
        console.log('✅ RPC Success - Data count:', data?.length || 0)
        return (data || []) as unknown as CallLog[]
      }

      // Otherwise use regular query builder (existing flow)
      let query: any = supabase
        .from('pype_voice_call_logs')
        .select(select)
        .eq('agent_id', agentId)
        .range(pageParam, pageParam + limit - 1)

      filters.forEach((filter: any) => {
        switch (filter.operator) {
          case 'eq':
            query = query.eq(filter.column, filter.value)
            break
          case 'ilike':
            query = query.ilike(filter.column, filter.value)
            break
          case 'gte':
            query = query.gte(filter.column, filter.value)
            break
          case 'lte':
            query = query.lte(filter.column, filter.value)
            break
          case 'gt':
            query = query.gt(filter.column, filter.value)
            break
          case 'lt':
            query = query.lt(filter.column, filter.value)
            break
          case 'not.is':
            // For JSONB paths with ->>, Supabase PostgREST needs path without quotes
            // We receive: "transcription_metrics->>'final_disposition'"
            // PostgREST needs: transcription_metrics->>final_disposition
            if (filter.column.includes("->>'")) {
              // Remove quotes from JSONB path for PostgREST
              // "transcription_metrics->>'final_disposition'" -> "transcription_metrics->>final_disposition"
              const unquotedPath = filter.column.replace(/->>'/g, '->>').replace(/'/g, '')
              // For json_exists, check both IS NOT NULL AND != '' (both must be true)
              // Apply both filters separately (PostgREST combines with AND)
              query = query.filter(unquotedPath, 'not.is', null)
              query = query.filter(unquotedPath, 'neq', '')
            } else if (filter.column.includes('->')) {
              // JSONB path with -> (not ->>)
              query = query.filter(filter.column, 'not.is', filter.value)
            } else {
              query = query.not(filter.column, 'is', filter.value)
            }
            break
          default:
            query = query.filter(filter.column, filter.operator, filter.value)
        }
      })

      query = query.order(orderBy.column, { ascending: orderBy.ascending })

      const { data, error } = await query

      if (error) throw error

      // Let TypeScript infer the type naturally from Supabase
      return data as unknown as CallLog[]
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