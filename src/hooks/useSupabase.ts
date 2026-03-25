// hooks/useSupabase.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import {
  postSupabaseSelect,
} from '@/lib/supabase-select-client'
import type {
  Filter,
  FilterOperator,
  InfiniteQueryOptions,
  QueryOptions,
} from '@/lib/supabase-query-types'

export type { Filter, FilterOperator, InfiniteQueryOptions, QueryOptions }

export const useSupabaseQuery = <T = any>(
  table: string,
  options: QueryOptions | null | undefined = {}
) => {
  return useQuery<T[]>({
    queryKey: [table, options],
    queryFn: async () => {
      if (!options) return []
      const { auth, ...query } = options
      const data = await postSupabaseSelect<T>({
        table,
        mode: 'list',
        query: {
          select: query.select ?? '*',
          filters: query.filters,
          orderBy: query.orderBy,
          limit: query.limit,
        },
        auth,
      })
      return data as T[]
    },
    enabled: options !== null && options !== undefined,
  })
}

export const useSupabaseInfiniteQuery = <T = any>(
  table: string,
  options: InfiniteQueryOptions
) => {
  return useInfiniteQuery<T[]>({
    queryKey: [table, 'infinite', options],
    enabled: options.enabled !== false,
    queryFn: async ({ pageParam }) => {
      const { auth, ...rest } = options
      const data = await postSupabaseSelect<T>({
        table,
        mode: 'infinite',
        query: {
          select: rest.select ?? '*',
          filters: rest.filters,
          orderBy: rest.orderBy,
          pageParam,
          cursorColumn: rest.cursorColumn,
          pageSize: rest.pageSize,
        },
        auth,
      })
      return data as T[]
    },
    getNextPageParam: (lastPage: T[]) => {
      if (!lastPage || lastPage.length < options.pageSize) {
        return undefined
      }
      const lastItem = lastPage[lastPage.length - 1] as Record<string, unknown>
      return lastItem ? lastItem[options.cursorColumn] : undefined
    },
    initialPageParam: undefined,
  })
}
