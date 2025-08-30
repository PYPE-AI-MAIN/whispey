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
  // ALWAYS call useSupabaseQuery - never conditionally
  const result = useSupabaseQuery("pype_voice_spans", {
    select: "*",
    filters: sessionTrace?.trace_key 
      ? [{ column: "trace_key", operator: "eq", value: sessionTrace.trace_key }] 
      : [{ column: "trace_key", operator: "eq", value: "no-trace-key" }], // Use trace_key field instead of id
    orderBy: { column: "start_time_ns", ascending: true },
  });

  // Return empty data if no trace_key, but still call the hook
  if (!sessionTrace?.trace_key) {
    return {
      ...result,
      data: []
    };
  }

  return result;
};
