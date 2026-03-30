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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transcript_json: sanitizeValue(log.transcript_json) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // Show current page data while the new page is loading (no blank flash)
    placeholderData: keepPreviousData,
  })
}
