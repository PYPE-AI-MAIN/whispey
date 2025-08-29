import { useSupabaseQuery } from "./useSupabase";

export const useSessionTrace = (sessionId: string) => {    
    const result = useSupabaseQuery("pype_voice_session_traces", {
      select: "*",
      filters: [{ column: "session_id", operator: "eq", value: sessionId }],
    });
    
    const singleResult = {
      ...result,
      data: result.data?.[0] || null
    };
        return singleResult;
  };

export const useSessionSpans = (sessionTrace: any) => {
  return useSupabaseQuery("pype_voice_spans", {
    select: "*",
    filters: sessionTrace?.trace_key ? [{ column: "trace_key", operator: "eq", value: sessionTrace.trace_key }] : [],
    orderBy: { column: "start_time_ns", ascending: true },
  })
}