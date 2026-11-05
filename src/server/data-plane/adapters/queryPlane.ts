/**
 * The ports over a PostgREST-style client. The ONLY place call-data table names
 * live (the guard test fails anywhere else). Pype's Supabase client and the
 * customer PostgREST client both expose from() and rpc() with the same query
 * builder, so one implementation serves both stores.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Filter } from '@/lib/supabase-query-types'
import { DestinationUnavailable } from '../errors'
import type { DataPlane, Row, SelectQuery } from '../ports'

export type Db = Pick<SupabaseClient, 'from' | 'rpc'>

const T = {
  callLogs: 'pype_voice_call_logs',
  metrics: 'pype_voice_metrics_logs',
  traces: 'pype_voice_session_traces',
  spans: 'pype_voice_spans',
  reprocess: 'pype_voice_reprocess_status',
  dropoff: 'pype_voice_dropoff_calls',
  tickets: 'qa_flag_tickets',
  dnc: 'pype_voice_dnc_list',
}

/** Tables the supabase-select proxy may read through the router. */
const SELECTABLE = new Set([T.callLogs, T.metrics, T.traces, T.spans])
export const isCallDataTable = (table: string) => SELECTABLE.has(table)
export const isCallLogsTable = (table: string) => table === T.callLogs

const PAGE = 500
// at or under the PostgREST max-rows default (1000), or a page would come back short and end the loop early
const PAGE_ANALYTICS = 1000
export const ANALYTICS_COLUMNS =
  'id,call_id,agent_id,customer_number,call_started_at,call_ended_at,call_ended_reason,transcript_type,wcall_event,environment,duration_seconds,billing_duration_seconds,avg_latency,total_stt_cost,total_tts_cost,total_llm_cost'
const SCOPE_VALUES = new Set(['global', 'project', 'agent'])

/**
 * The PostgREST filter for DNC rows that apply to a call: global rows always,
 * project rows for its project, agent rows for its agent only. Same rule as the
 * backend (utils/dnc.py) and the scheduler.
 */
export function dncScopeFilter(projectId?: string | null, agentId?: string | null): string {
  const clauses = ['scope.eq.global']
  if (projectId) clauses.push(`and(scope.eq.project,project_id.eq.${projectId})`)
  if (agentId) clauses.push(`and(scope.eq.agent,agent_id.eq.${agentId})`)
  return clauses.join(',')
}

export function applyFilters(query: any, filters: Filter[]) {
  let q = query
  for (const f of filters) {
    switch (f.operator) {
      case 'eq': q = q.eq(f.column, f.value); break
      case 'neq':
      case '<>': q = q.neq(f.column, f.value); break
      case 'gt': q = q.gt(f.column, f.value); break
      case 'gte': q = q.gte(f.column, f.value); break
      case 'lt': q = q.lt(f.column, f.value); break
      case 'lte': q = q.lte(f.column, f.value); break
      case 'like': q = q.like(f.column, f.value as string); break
      case 'ilike': q = q.ilike(f.column, f.value as string); break
      case 'in': q = q.in(f.column, f.value as unknown[]); break
      case 'not.is': q = q.not(f.column, 'is', f.value); break
      case 'is': q = q.is(f.column, f.value); break
      default: break
    }
  }
  return q
}

/**
 * `typed` is true for customer destinations: a network failure, timeout or 5xx
 * is a DestinationUnavailable (counted by the breaker). Pype keeps today's
 * behaviour: every failure is a plain Error carrying the database message.
 */
export function createQueryPlane(db: Db, opts: { typed: boolean; destination?: string }): Omit<DataPlane, 'storage'> {
  const fail = (res: { error: any; status?: number }): never => {
    if (opts.typed && (!res.status || res.status >= 500)) throw new DestinationUnavailable(opts.destination)
    throw Object.assign(new Error(res.error.message), { code: res.error.code, details: res.error.details })
  }
  const ok = <R extends { error: any; status?: number }>(res: R): R => (res.error ? fail(res) : res)

  const selectRows = async (table: string, q: SelectQuery): Promise<Row[]> => {
    if (!isCallDataTable(table)) throw new Error('Table is not call data')
    let query: any = applyFilters(db.from(table).select(q.select || '*'), q.filters ?? [])
    if (q.cursor) query = query.gt(q.cursor.column, q.cursor.value)
    if (q.orderBy) query = query.order(q.orderBy.column, { ascending: q.orderBy.ascending })
    if (q.thenBy) query = query.order(q.thenBy, { ascending: true })
    if (q.range) query = query.range(q.range[0], q.range[1])
    else if (q.limit) query = query.limit(q.limit)
    return ((await ok(await query)).data ?? []) as Row[]
  }

  return {
    callData: {
      async countCallLogs(q) {
        let query: any = db.from(T.callLogs).select('*', { count: 'exact', head: true })
        query = q.agentIds.length === 1 ? query.eq('agent_id', q.agentIds[0]) : query.in('agent_id', q.agentIds)
        const col = q.dateColumn ?? 'created_at'
        if (q.from) query = query.gte(col, q.from)
        if (q.to) query = query.lte(col, q.to)
        query = applyFilters(query, q.filters ?? [])
        if (q.emptyColumns?.length) {
          query = query.or(q.emptyColumns.flatMap((c) => [`${c}.is.null`, `${c}.eq.{}`]).join(','))
        }
        return (await ok(await query)).count ?? 0
      },
      async getCallLog(id, columns) {
        return (await ok(await db.from(T.callLogs).select(columns).eq('id', id).maybeSingle())).data as Row | null
      },
      async findCallLogs(agentId, ids, columns) {
        return ((await ok(await db.from(T.callLogs).select(columns).eq('agent_id', agentId).in('id', ids))).data ?? []) as unknown as Row[]
      },
      async listCampaignCalls(agentId, campaignId, customerNumbers) {
        const res = await db.from(T.callLogs).select('*').eq('agent_id', agentId)
          .filter('metadata->>campaignId', 'eq', campaignId)
          .in('customer_number', customerNumbers)
          .order('call_started_at', { ascending: false })
        return (ok(res).data ?? []) as Row[]
      },
      async listTurns(sessionId) {
        const res = await db.from(T.metrics)
          .select('id, user_transcript, agent_response, tool_calls, unix_timestamp, created_at')
          .eq('session_id', sessionId)
          .order('unix_timestamp', { ascending: true })
        return (ok(res).data ?? []) as Row[]
      },
      async campaignGroupedCallLogs(params) {
        return ((await ok(await db.rpc('get_campaign_grouped_call_logs', params))).data ?? []) as Row[]
      },
      async queryCallLogs(args, user) {
        const withUser = { ...args, p_user_clerk_id: user.clerkId, p_user_email: user.email }
        let res = await db.rpc('get_call_logs_with_distinct', withUser)
        if (res.error?.code === 'PGRST202') {
          // Older functions take the 13 data arguments only. The customer schema also needs the agent
          // allow-list (NULL returns nothing); access to this agent was already checked by the caller.
          res = await db.rpc('get_call_logs_with_distinct', opts.typed ? { ...args, p_allowed_agent_ids: [args.p_agent_id] } : args)
        }
        return (ok(res).data ?? []) as Row[]
      },
      selectRows,
      async analyticsRows(q) {
        const rows: Row[] = []
        for (let from = 0; from <= q.maxRows; from += PAGE_ANALYTICS) {
          const page = await selectRows(T.callLogs, {
            select: ANALYTICS_COLUMNS,
            filters: [
              { column: 'agent_id', operator: 'in', value: q.agentIds },
              { column: 'call_started_at', operator: 'gte', value: q.from },
              { column: 'call_started_at', operator: 'lt', value: q.to },
            ],
            orderBy: { column: 'call_started_at', ascending: true },
            thenBy: 'id', // call_started_at ties (bulk campaigns) would otherwise shuffle between pages
            range: [from, from + PAGE_ANALYTICS - 1],
          })
          rows.push(...page)
          if (page.length < PAGE_ANALYTICS) break
        }
        return rows
      },
      async countRows(table, filters) {
        if (!isCallDataTable(table)) throw new Error('Table is not call data')
        const res = await applyFilters(db.from(table).select('*', { count: 'exact', head: true }), filters)
        return ok(res).count ?? 0
      },
    },
    callLogs: {
      async insertCallLog(row) {
        return (await ok(await db.from(T.callLogs).insert(row).select().single())).data as Row
      },
      async insertTurns(rows) {
        ok(await db.from(T.metrics).insert(rows))
      },
      async setTranscriptionMetrics(id, metrics) {
        ok(await db.from(T.callLogs).update({ transcription_metrics: metrics }).eq('id', id))
      },
      async deleteCallDataForAgents(agentIds) {
        // Per-turn rows are keyed by the call log id (session_id), so they go first, by log id.
        for (;;) {
          const page = ok(await db.from(T.callLogs).select('id').in('agent_id', agentIds).limit(PAGE))
          const ids = (page.data ?? []).map((r: Row) => r.id)
          if (ids.length === 0) return
          ok(await db.from(T.metrics).delete().in('session_id', ids))
          const gone = ok(await db.from(T.callLogs).delete().in('id', ids).select('id'))
          if (!gone.data?.length || ids.length < PAGE) return
        }
      },
    },
    qa: {
      async upsertFlagTicket(row) {
        ok(await db.from(T.tickets).upsert(row, { onConflict: 'call_log_id,flag_id', ignoreDuplicates: true }))
      },
      async findTicketId(callLogId, flagId) {
        const res = await db.from(T.tickets).select('id').eq('call_log_id', callLogId).eq('flag_id', flagId).maybeSingle()
        return (ok(res).data as Row | null)?.id ?? null
      },
      async updatePendingReason(callLogId, flagId, reason) {
        ok(await db.from(T.tickets).update({ reason }).eq('call_log_id', callLogId).eq('flag_id', flagId).eq('status', 'pending'))
      },
      async deletePending(callLogId, flagId) {
        ok(await db.from(T.tickets).delete().eq('call_log_id', callLogId).eq('flag_id', flagId).eq('status', 'pending'))
      },
      async listTickets(agentId, q) {
        let query = db.from(T.tickets).select(q.columns, { count: 'exact' }).eq('agent_id', agentId)
        if (q.status) query = query.eq('status', q.status)
        const res = ok(await query.order('flagged_at', { ascending: false }).range(q.from, q.to))
        return { rows: (res.data ?? []) as unknown as Row[], total: res.count ?? 0 }
      },
      async countByStatus(agentId, statuses) {
        const counts = await Promise.all(
          statuses.map(async (s) => ok(await db.from(T.tickets).select('id', { count: 'exact', head: true }).eq('agent_id', agentId).eq('status', s)).count ?? 0)
        )
        return Object.fromEntries(statuses.map((s, i) => [s, counts[i]]))
      },
      async getTicket(id, columns) {
        return (ok(await db.from(T.tickets).select(columns).eq('id', id).maybeSingle()).data ?? null) as Row | null
      },
      async updateTicket(id, patch, columns) {
        return ok(await db.from(T.tickets).update(patch).eq('id', id).select(columns).single()).data as unknown as Row
      },
    },
    dnc: {
      async listEntries(q) {
        let query = db.from(T.dnc)
          .select('id, phone_e164, phone_raw, scope, project_id, agent_id, call_log_id, reason, source, added_by, created_at', { count: 'exact' })
          .eq('is_active', true)
          .order('created_at', { ascending: false })
        if (q.scope) query = query.eq('scope', q.scope)
        if (q.projectId) query = query.eq('project_id', q.projectId)
        if (q.agentId) query = query.eq('agent_id', q.agentId)
        if (q.source === 'auto') query = query.eq('source', 'auto')
        if (q.source === 'manual') query = query.neq('source', 'auto')
        if (q.digits) query = query.ilike('phone_e164', `%${q.digits}%`)
        const res = ok(await query.limit(q.limit))
        return { rows: (res.data ?? []) as unknown as Row[], total: res.count ?? 0 }
      },
      async findActive(phones, scope, projectId, agentId) {
        let query = db.from(T.dnc).select('phone_e164').eq('is_active', true).eq('scope', scope).in('phone_e164', phones)
        if (scope === 'project') query = query.eq('project_id', projectId!)
        if (scope === 'agent') query = query.eq('agent_id', agentId!)
        return (ok(await query).data ?? []).map((r: Row) => r.phone_e164 as string)
      },
      async addEntries(rows) {
        ok(await db.from(T.dnc).insert(rows))
      },
      async deactivate(id) {
        ok(await db.from(T.dnc).update({ is_active: false, deleted_at: new Date().toISOString() }).eq('id', id).eq('is_active', true))
      },
      async findBlocked(phones, projectId, agentId) {
        const res = await db.from(T.dnc).select('phone_e164, scope')
          .eq('is_active', true).in('phone_e164', phones).or(dncScopeFilter(projectId, agentId))
        return (ok(res).data ?? []).filter((r: Row) => SCOPE_VALUES.has(r.scope)) as any
      },
    },
  }
}
