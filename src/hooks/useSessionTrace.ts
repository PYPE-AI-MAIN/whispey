// hooks/useSessionTrace.ts
import { useSupabaseQuery, useSupabaseInfiniteQuery } from './useSupabase'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { postSupabaseSelect } from '@/lib/supabase-select-client'

export interface Span {
  id: string
  span_id?: string
  trace_key?: string
  name?: string
  operation_type?: string
  start_time_ns: number
  end_time_ns?: number
  duration_ms?: number
  status?: string
  parent_span_id?: string
  captured_at?: number
  attributes?: unknown
  events?: unknown
  level?: number
  children?: Span[]
  spanId?: string
}

export interface SessionTrace {
  id: string
  session_id: string
  trace_key: string
  [key: string]: unknown
}

export const useSessionTrace = (sessionId: string | null, agentId?: string) => {
  const result = useSupabaseQuery<SessionTrace>(
    'pype_voice_session_traces',
    sessionId
      ? {
          // Fetch only the columns needed for span queries and overview display.
          // span_summary (~14 KB JSONB) and performance_summary are excluded here
          // because they are only rendered in the Trace/Waterfall tabs which
          // already lazy-load spans separately.
          select: 'id, session_id, trace_key, total_spans, session_start_time, session_end_time, total_duration_ms, created_at',
          filters: [{ column: 'session_id', operator: 'eq', value: sessionId }],
          auth: agentId ? { agentId } : undefined,
        }
      : null
  )

  return {
    ...result,
    data: result.data?.[0] || null,
  }
}

export const useSessionSpans = (sessionTrace: SessionTrace | null, agentId?: string) => {
  const result = useSupabaseQuery<Span>('pype_voice_spans', {
    select:
      'id, span_id, trace_key, name, operation_type, start_time_ns, end_time_ns, duration_ms, status, parent_span_id, captured_at',
    filters: sessionTrace?.trace_key
      ? [{ column: 'trace_key', operator: 'eq', value: sessionTrace.trace_key }]
      : [{ column: 'trace_key', operator: 'eq', value: 'no-trace-key' }],
    orderBy: { column: 'start_time_ns', ascending: true },
    auth: agentId ? { agentId } : undefined,
  })

  if (!sessionTrace?.trace_key) {
    return {
      ...result,
      data: [],
    }
  }

  return result
}

export const useSessionSpansInfinite = (sessionTrace: SessionTrace | null, enabled = true, agentId?: string) => {
  const shouldFetch = enabled && Boolean(sessionTrace?.trace_key)

  const result = useSupabaseInfiniteQuery<Span>('pype_voice_spans', {
    select:
      'id, span_id, trace_key, name, operation_type, start_time_ns, end_time_ns, duration_ms, status, parent_span_id, captured_at, attributes',
    filters: sessionTrace?.trace_key
      ? [{ column: 'trace_key', operator: 'eq', value: sessionTrace.trace_key }]
      : [{ column: 'trace_key', operator: 'eq', value: 'no-trace-key' }],
    orderBy: { column: 'start_time_ns', ascending: true },
    pageSize: 50,
    cursorColumn: 'start_time_ns',
    enabled: shouldFetch,
    auth: agentId ? { agentId } : undefined,
  })

  const { data: countData } = useQuery({
    queryKey: ['pype_voice_spans_count', sessionTrace?.trace_key, agentId],
    queryFn: async () => {
      if (!sessionTrace?.trace_key) return 0
      const count = await postSupabaseSelect({
        table: 'pype_voice_spans',
        mode: 'count',
        query: {
          filters: [{ column: 'trace_key', operator: 'eq', value: sessionTrace.trace_key }],
        },
        auth: agentId ? { agentId } : undefined,
      })
      return count as number
    },
    enabled: shouldFetch && Boolean(agentId),
  })

  const allSpans = useMemo(() => {
    if (!result.data?.pages) return []
    return result.data.pages.flat()
  }, [result.data?.pages])

  if (!sessionTrace?.trace_key) {
    return {
      ...result,
      data: [],
      allSpans: [],
      totalCount: 0,
    }
  }

  return {
    ...result,
    allSpans,
    totalCount: countData || 0,
  }
}
