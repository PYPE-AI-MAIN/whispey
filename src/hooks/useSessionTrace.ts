import { useSupabaseQuery } from "./useSupabase";

// hooks/useSessionTrace.ts
export const useSessionTrace = (sessionId: string | null) => {    
  const result = useSupabaseQuery("pype_voice_session_traces", {
    select: "*",
    filters: sessionId ? [{ column: "session_id", operator: "eq", value: sessionId }] : [],
  });
  
  const singleResult = {
    ...result,
    data: result.data?.[0] || null
  };
  return singleResult;
};

export const useSessionSpans = (sessionTrace: any) => {
  const result = useSupabaseQuery("pype_voice_spans", {
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