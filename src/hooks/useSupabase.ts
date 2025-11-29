// hooks/useSupabase.ts
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type FilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in";

export interface Filter {
  column: string;
  operator: FilterOperator;
  value: any;
}

export interface QueryOptions {
  select?: string | null;
  filters?: Filter[];
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
}

// Apply filters to a Supabase query
const applyFilters = (query: any, filters: Filter[]) => {
  filters.forEach((filter) => {
    switch (filter.operator) {
      case "eq":
        query = query.eq(filter.column, filter.value);
        break;
      case "neq":
        query = query.neq(filter.column, filter.value);
        break;
      case "gt":
        query = query.gt(filter.column, filter.value);
        break;
      case "gte":
        query = query.gte(filter.column, filter.value);
        break;
      case "lt":
        query = query.lt(filter.column, filter.value);
        break;
      case "lte":
        query = query.lte(filter.column, filter.value);
        break;
      case "like":
        query = query.like(filter.column, filter.value);
        break;
      case "ilike":
        query = query.ilike(filter.column, filter.value);
        break;
      case "in":
        query = query.in(filter.column, filter.value);
        break;
    }
  });
  return query;
};

// Original useSupabaseQuery with generic type
export const useSupabaseQuery = <T = any>(
  table: string, 
  options: QueryOptions | null | undefined = {}
) => {
  return useQuery<T[]>({
    queryKey: [table, options],
    queryFn: async () => {
      if (!options) return []; // Return empty array if options is null
      
      let query = supabase.from(table).select(options.select || "*");

      if (options.filters) {
        query = applyFilters(query, options.filters);
      }

      if (options.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending,
        });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as T[];
    },
    enabled: options !== null && options !== undefined, // Only run query if options exist
  });
};

// New: Infinite query hook for cursor-based pagination with generic type
export interface InfiniteQueryOptions extends QueryOptions {
  pageSize: number;
  cursorColumn: string;
}

export const useSupabaseInfiniteQuery = <T = any>(
  table: string,
  options: InfiniteQueryOptions
) => {
  return useInfiniteQuery<T[]>({
    queryKey: [table, "infinite", options],
    queryFn: async ({ pageParam }: { pageParam: any }) => {
      let query = supabase.from(table).select(options.select || "*");

      // Apply base filters (excluding cursor)
      if (options.filters) {
        query = applyFilters(query, options.filters);
      }

      // Apply cursor for pagination (if pageParam exists)
      if (pageParam !== undefined && pageParam !== null) {
        query = query.gt(options.cursorColumn, pageParam);
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending,
        });
      }

      // Apply page size limit
      query = query.limit(options.pageSize);

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as T[];
    },
    getNextPageParam: (lastPage: T[]) => {
      // If page is empty or less than pageSize, no more pages
      if (!lastPage || lastPage.length < options.pageSize) {
        return undefined;
      }

      // Return the cursor value from the last item
      const lastItem = lastPage[lastPage.length - 1] as any;
      return lastItem ? lastItem[options.cursorColumn] : undefined;
    },
    initialPageParam: undefined,
  });
};