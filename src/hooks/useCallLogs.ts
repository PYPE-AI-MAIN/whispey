// hooks/useCallLogs.ts
'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { CallLog } from '@/types/logs'

// ---------------------------------------------------------------------------
// Internal-tag sanitisation
// ---------------------------------------------------------------------------
// The voice-agent pipeline embeds control tags (e.g. <eod/>) directly inside
// the LLM text stream as signals for automated actions.  Those tags must never
// reach the end-user — strip them from every string in the text-bearing fields
// before the data leaves this hook.

/** Matches any self-closing internal pipeline control tag, e.g. <eod/>. */
const INTERNAL_TAG_RE = /<(?:eod)\s*\/>/gi

/** Remove all internal control tags from a single string. */
function sanitizeText(text: string): string {
  return text.replace(INTERNAL_TAG_RE, '').trim()
}

/**
 * Recursively walk an arbitrary value and strip internal tags from every
 * string it contains.  Arrays and plain objects are traversed; primitives
 * other than strings are returned unchanged.
 */
function sanitizeValue(val: unknown): unknown {
  if (typeof val === 'string') return sanitizeText(val)
  if (Array.isArray(val)) return val.map(sanitizeValue)
  if (val !== null && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, sanitizeValue(v)]),
    )
  }
  return val
}

/**
 * Return a copy of a CallLog with internal tags stripped from all text fields.
 * Only `transcript_json` and `metadata` are walked (they contain the
 * conversation text); the rest of the fields are identity-copied.
 */
function sanitizeCallLog(log: CallLog): CallLog {
  return {
    ...log,
     
    transcript_json: sanitizeValue(log.transcript_json) as any,
     
    metadata: sanitizeValue(log.metadata) as any,
  }
}

interface DistinctConfig {
  column: string
  jsonField?: string
  order: 'asc' | 'desc'
}

interface UseCallLogsOptions {
  agentId: string | undefined
  /** When set, loads via project route so tags can be redacted for viewers. */
  projectId?: string
  preDistinctFilters: unknown[]
  postDistinctFilters: unknown[]
  select?: string
  orderBy?: { column: string; ascending: boolean }
  distinctConfig?: DistinctConfig
  dateRange?: { from: string; to: string }
  /** Which page to fetch (1-based). Each page is cached independently. */
  page?: number
  enabled?: boolean
  refetchOnMount?: boolean
  refetchOnWindowFocus?: boolean
  /** Re-run the query on this interval (ms) while enabled — e.g. to wait for a fresh row to land. */
  refetchInterval?: number | false
  staleTime?: number
  gcTime?: number
  userId?: string
  userEmail?: string
}

export const PAGE_SIZE = 50

export const buildCallLogsQueryKey = (
  projectId: string,
  agentId: string,
  preDistinctFilters: unknown[],
  postDistinctFilters: unknown[],
  select: string,
  orderBy: { column: string; ascending: boolean },
  distinctConfig: DistinctConfig | undefined,
  dateRange: { from: string; to: string } | undefined,
  userId: string,
  page: number,
) => [
  'call-logs',
  'server',
  projectId,
  agentId,
  JSON.stringify(preDistinctFilters),
  JSON.stringify(postDistinctFilters),
  select,
  `${orderBy.column}-${orderBy.ascending}`,
  distinctConfig ? JSON.stringify(distinctConfig) : 'no-distinct',
  dateRange ? `${dateRange.from}-${dateRange.to}` : 'no-date-range',
  userId,
  `page-${page}`,
]

export const useCallLogs = ({
  agentId,
  projectId,
  preDistinctFilters = [],
  postDistinctFilters = [],
  select = '*',
  orderBy = { column: 'created_at', ascending: false },
  distinctConfig,
  dateRange,
  page = 1,
  enabled = true,
  refetchOnMount = false,
  refetchOnWindowFocus = false,
  refetchInterval = false,
  staleTime = 5 * 60 * 1000,
  gcTime = 10 * 60 * 1000,
  userId,
  userEmail,
}: UseCallLogsOptions) => {
  const offset = (page - 1) * PAGE_SIZE

  const queryKey = buildCallLogsQueryKey(
    projectId ?? '',
    agentId ?? '',
    preDistinctFilters,
    postDistinctFilters,
    select,
    orderBy,
    distinctConfig,
    dateRange,
    userId ?? 'no-user',
    page,
  )

  return useQuery<CallLog[]>({
    queryKey,

    queryFn: async ({ signal }) => {
      if (!agentId) throw new Error('Agent ID required')

      const body = {
        p_agent_id: agentId,
        p_pre_distinct_filters: preDistinctFilters,
        p_post_distinct_filters: postDistinctFilters,
        p_select: select,
        p_order_by_column: orderBy.column,
        p_order_ascending: orderBy.ascending,
        p_limit: PAGE_SIZE,
        p_offset: offset,
        p_distinct_column: distinctConfig?.column || null,
        p_distinct_json_field: distinctConfig?.jsonField || null,
        p_distinct_order: distinctConfig?.order || 'asc',
        p_date_from: dateRange?.from || null,
        p_date_to: dateRange?.to || null,
        p_user_clerk_id: userId || null,
        p_user_email: userEmail || null,
      }

      const url = projectId
        ? `/api/projects/${projectId}/call-logs/query`
        : `/api/agents/${agentId}/call-logs/query`

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      const json = (await res.json()) as { data?: CallLog[]; error?: string }
      if (!res.ok) throw new Error(json.error || res.statusText)
      // Strip internal control tags (e.g. <eod/>) from every call log before
      // the data reaches any component — users should never see those signals.
      return (json.data || []).map(sanitizeCallLog)
    },

    enabled: enabled && !!agentId,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    refetchOnMount,
    refetchInterval,
    // Show current page data while the new page is loading (no blank flash)
    placeholderData: keepPreviousData,
  })
}

const CALL_LOG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether a string can be a call log id (a link's ?call= value). */
export const isCallLogId = (id: string | null | undefined): id is string => !!id && CALL_LOG_ID.test(id)

/**
 * One call log by id, whatever page, date range or filter the list is on — for
 * a shared link (?call=<id>) to a call that isn't in the loaded page. Same
 * endpoint, columns and access checks as the list. null when it doesn't exist
 * (or isn't this agent's).
 */
export const useCallLogById = ({
  agentId,
  projectId,
  callId,
  select,
  enabled = true,
  userId,
  userEmail,
}: {
  agentId: string | undefined
  projectId?: string
  callId: string | null
  select: string
  enabled?: boolean
  userId?: string
  userEmail?: string
}) =>
  useQuery<CallLog | null>({
    queryKey: ['call-log-by-id', agentId, callId, select],
    queryFn: async ({ signal }) => {
      const body = {
        p_agent_id: agentId,
        p_pre_distinct_filters: [{ column: 'id', operator: 'eq', value: callId }],
        p_post_distinct_filters: [],
        p_select: select,
        p_order_by_column: 'created_at',
        p_order_ascending: false,
        p_limit: 1,
        p_offset: 0,
        p_distinct_column: null,
        p_distinct_json_field: null,
        p_distinct_order: 'asc',
        p_date_from: null,
        p_date_to: null,
        p_user_clerk_id: userId || null,
        p_user_email: userEmail || null,
      }
      const url = projectId ? `/api/projects/${projectId}/call-logs/query` : `/api/agents/${agentId}/call-logs/query`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      const json = (await res.json()) as { data?: CallLog[]; error?: string }
      if (!res.ok) throw new Error(json.error || res.statusText)
      const found = (json.data || []).find((c) => c.id === callId)
      return found ? sanitizeCallLog(found) : null
    },
    enabled: enabled && !!agentId && isCallLogId(callId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
