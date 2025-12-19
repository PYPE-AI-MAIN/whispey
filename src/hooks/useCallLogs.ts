// hooks/useCallLogs.ts
'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CallLog } from '@/types/logs'

interface UseCallLogsOptions {
  agentId: string | undefined
  filters: any[]
  select?: string
  orderBy?: { column: string; ascending: boolean }
  enabled?: boolean
  refetchOnMount?: boolean
  refetchOnWindowFocus?: boolean
  staleTime?: number
  gcTime?: number
}

export const useCallLogs = ({
  agentId,
  filters = [],
  select = '*',
  orderBy = { column: 'created_at', ascending: false },
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
      JSON.stringify(filters), 
      select, 
      `${orderBy.column}-${orderBy.ascending}`
    ],
    
    initialPageParam: 0,
    
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      if (!agentId) throw new Error('Agent ID required')

      const limit = 50
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
            query = query.not(filter.column, 'is', filter.value)
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