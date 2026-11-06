/**
 * Ports: what routes need from call data, written from the call sites that exist
 * today. Routes depend on these, never on a database client or a table name.
 */
import type { Filter } from '@/lib/supabase-query-types'

export type Row = Record<string, any>

export interface CountQuery {
  /** One id counts with eq, several with in. */
  agentIds: string[]
  dateColumn?: 'created_at' | 'call_started_at'
  from?: string
  to?: string
  filters?: Filter[]
  /** Match rows where ANY of these JSON columns is null or `{}` (reprocess "empty only"). */
  emptyColumns?: string[]
}

export interface SelectQuery {
  select?: string
  filters?: Filter[]
  orderBy?: { column: string; ascending: boolean }
  limit?: number
  range?: [number, number]
  /** Tie-breaker after `orderBy`, ascending (keeps offset paging stable). */
  thenBy?: string
  /** Keyset paging: rows with `cursorColumn` greater than `cursor`. */
  cursor?: { column: string; value: unknown }
}

export interface CallLogsQueryArgs {
  p_agent_id: string
  p_select: unknown
  [param: string]: unknown
}

export interface CallDataReader {
  countCallLogs(q: CountQuery): Promise<number>
  getCallLog(id: string, columns: string): Promise<Row | null>
  findCallLogs(agentId: string, ids: string[], columns: string): Promise<Row[]>
  /** Every call of the given contacts in one campaign, newest first. */
  listCampaignCalls(agentId: string, campaignId: string, customerNumbers: string[]): Promise<Row[]>
  listTurns(sessionId: string): Promise<Row[]>
  campaignGroupedCallLogs(params: Record<string, unknown>): Promise<Row[]>
  campaignGroupedCount(params: Record<string, unknown>): Promise<number>
  /** One row per contact: { customer_number, call_count }. */
  campaignCallCounts(agentId: string, campaignId: string): Promise<Row[]>
  campaignContactCalls(agentId: string, campaignId: string, customerNumber: string): Promise<Row[]>
  /** The paged, distinct-aware call-log query (RPC); the 13-argument fallback lives in the adapter. */
  queryCallLogs(args: CallLogsQueryArgs, user: { clerkId: string; email: string | null }): Promise<Row[]>
  /** Generic read for the supabase-select proxy; `table` must pass `isCallDataTable`. */
  selectRows(table: string, q: SelectQuery): Promise<Row[]>
  countRows(table: string, filters: Filter[]): Promise<number>
  /** Overview analytics input: the columns the aggregator reads, call_started_at in [from, to) (UTC `timestamp` text), at most maxRows. */
  analyticsRows(q: { agentIds: string[]; from: string; to: string; maxRows: number; /** comma list; default is the base columns */ columns?: string }): Promise<Row[]>
  /**
   * Runs one analytics Spec inside the customer database (api.analytics_run, schema revision 2+). Rejects with
   * `code: 'PGRST202'` when the function is not installed. Pype's own plane has no such function.
   */
  analyticsRun(spec: Record<string, unknown>, ctx: { project_id: string; agent_ids: string[]; tz: string; now?: string }): Promise<Row[]>
  /** Newest calls of one agent since `from`, with the given columns (field-catalog sampling). */
  sampleCallRows(q: { agentId: string; from: string; limit: number; columns: string }): Promise<Row[]>
}

export interface CallLogMutator {
  insertCallLog(row: Row): Promise<Row>
  insertTurns(rows: Row[]): Promise<void>
  /** The call_started row of this call, if the worker already sent one. */
  findStartedLog(agentId: string, callId: string): Promise<{ id: string } | null>
  updateCallLog(id: string, patch: Row): Promise<Row>
  /** Session trace row; resolves with it (null when the store returned none). */
  insertTrace(row: Row): Promise<Row | null>
  insertSpans(rows: Row[]): Promise<void>
  setTranscriptionMetrics(id: string, metrics: Record<string, unknown>): Promise<void>
  /** Deletes the per-turn rows (keyed by call log id) and then the call logs of these agents. */
  deleteCallDataForAgents(agentIds: string[]): Promise<void>
}

export interface QaTicketStore {
  upsertFlagTicket(row: Row): Promise<void>
  findTicketId(callLogId: string, flagId: string): Promise<string | null>
  updatePendingReason(callLogId: string, flagId: string, reason: string): Promise<void>
  deletePending(callLogId: string, flagId: string): Promise<void>
  /** One page (rows `from`..`to`, inclusive) of an agent's tickets, newest flag first, with the total. */
  listTickets(agentId: string, q: { status?: string; from: number; to: number; columns: string }): Promise<{ rows: Row[]; total: number }>
  countByStatus(agentId: string, statuses: readonly string[]): Promise<Record<string, number>>
  getTicket(id: string, columns: string): Promise<Row | null>
  updateTicket(id: string, patch: Row, columns: string): Promise<Row>
}

export type DncScope = 'global' | 'project' | 'agent'

export interface DncListQuery {
  scope?: DncScope
  projectId?: string
  agentId?: string
  /** 'auto' = added by the checker; 'manual' = everything else. */
  source?: 'auto' | 'manual'
  /** Digits to match inside the number. */
  digits?: string
  limit: number
}

export interface DncStore {
  /** Active entries, newest first, with the total before the limit. */
  listEntries(q: DncListQuery): Promise<{ rows: Row[]; total: number }>
  /** Of these numbers, the ones already active in exactly this scope. */
  findActive(phones: string[], scope: DncScope, projectId?: string | null, agentId?: string | null): Promise<string[]>
  addEntries(rows: Row[]): Promise<void>
  /** Soft delete (keeps the audit trail). */
  deactivate(id: string): Promise<void>
  /** Active rows for these (already normalised) numbers that apply to the project or agent. */
  findBlocked(phones: string[], projectId?: string | null, agentId?: string | null): Promise<{ phone_e164: string; scope: DncScope }[]>
}

export interface ObjectStorage {
  /** Short-lived read link for one recording. */
  signRecordingUrl(key: string, ttlSeconds: number): Promise<string>
}

export interface DataPlane {
  callData: CallDataReader
  callLogs: CallLogMutator
  qa: QaTicketStore
  dnc: DncStore
  storage: ObjectStorage
}
