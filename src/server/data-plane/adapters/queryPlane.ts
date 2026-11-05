/**
 * The ports over a PostgREST-style client. The ONLY place call-data table names
 * live (the guard test fails anywhere else). Pype's Supabase client and the
 * customer PostgREST client both expose from() and rpc() with the same query
 * builder, so one implementation serves both stores.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Filter } from '@/lib/supabase-query-types'
import { dncScopeFilter } from '@/lib/dnc'
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

const PAGE = 500
const SCOPE_VALUES = new Set(['global', 'project', 'agent'])

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
          // Older functions (and customer schemas) take the 13 data arguments only.
          res = await db.rpc('get_call_logs_with_distinct', args)
        }
        return (ok(res).data ?? []) as Row[]
      },
      selectRows,
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
    },
    dnc: {
      async findBlocked(phones, projectId, agentId) {
        const res = await db.from(T.dnc).select('phone_e164, scope')
          .eq('is_active', true).in('phone_e164', phones).or(dncScopeFilter(projectId, agentId))
        return (ok(res).data ?? []).filter((r: Row) => SCOPE_VALUES.has(r.scope)) as any
      },
    },
  }
}
