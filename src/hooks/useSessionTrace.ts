// hooks/useSessionTrace.ts
import { useSupabaseQuery, useSupabaseInfiniteQuery } from "./useSupabase";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Define Span interface here so it can be exported
export interface Span {
  id: string;
  span_id?: string;
  trace_key?: string;
  name?: string;
  operation_type?: string;
  start_time_ns: number;
  end_time_ns?: number;
  duration_ms?: number;
  status?: string;
  parent_span_id?: string;
  captured_at?: number;
  attributes?: any;
  events?: any;
  level?: number;
  children?: Span[];
  spanId?: string;
}

// Define SessionTrace interface
export interface SessionTrace {
  id: string;
  session_id: string;
  trace_key: string;
  [key: string]: any;
}

export const useSessionTrace = (sessionId: string | null) => {    
  const result = useSupabaseQuery<SessionTrace>("pype_voice_session_traces", {
    select: "*",
    filters: sessionId ? [{ column: "session_id", operator: "eq", value: sessionId }] : [],
  });
  
  return {
    ...result,
    data: result.data?.[0] || null
  };
};

// Keep original for backward compatibility
export const useSessionSpans = (sessionTrace: any) => {
  const result = useSupabaseQuery<Span>("pype_voice_spans", {
    select: "id, span_id, trace_key, name, operation_type, start_time_ns, end_time_ns, duration_ms, status, parent_span_id, captured_at",
    filters: sessionTrace?.trace_key 
      ? [{ column: "trace_key", operator: "eq", value: sessionTrace.trace_key }] 
      : [{ column: "trace_key", operator: "eq", value: "no-trace-key" }],
    orderBy: { column: "start_time_ns", ascending: true },
  });

  if (!sessionTrace?.trace_key) {
    return {
      ...result,
      data: []
    };
  }

  return result;
};

// NEW: Infinite scroll version with proper typing and total count
export const useSessionSpansInfinite = (sessionTrace: any) => {
  const result = useSupabaseInfiniteQuery<Span>("pype_voice_spans", {
    select: "id, span_id, trace_key, name, operation_type, start_time_ns, end_time_ns, duration_ms, status, parent_span_id, captured_at, attributes, events",
    filters: sessionTrace?.trace_key 
      ? [{ column: "trace_key", operator: "eq", value: sessionTrace.trace_key }] 
      : [{ column: "trace_key", operator: "eq", value: "no-trace-key" }],
    orderBy: { column: "start_time_ns", ascending: true },
    pageSize: 50,
    cursorColumn: "start_time_ns",
  });

  // Fetch total count with a separate query
  const { data: countData } = useQuery({
    queryKey: ["pype_voice_spans_count", sessionTrace?.trace_key],
    queryFn: async () => {
      if (!sessionTrace?.trace_key) return 0;
      
      const { count, error } = await supabase
        .from("pype_voice_spans")
        .select("*", { count: 'exact', head: true })
        .eq("trace_key", sessionTrace.trace_key);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: Boolean(sessionTrace?.trace_key),
  });

  // Flatten all pages into a single array - now properly typed
  const allSpans = useMemo(() => {
    if (!result.data?.pages) return [];
    return result.data.pages.flat();
  }, [result.data?.pages]);

  if (!sessionTrace?.trace_key) {
    return {
      ...result,
      data: [],
      allSpans: [],
      totalCount: 0,
    };
  }

  return {
    ...result,
    allSpans, // Now properly typed as Span[]
    totalCount: countData || 0, // Total count from database
  };
};