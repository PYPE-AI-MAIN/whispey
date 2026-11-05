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
  /** The paged, distinct-aware call-log query (RPC); the 13-argument fallback lives in the adapter. */
  queryCallLogs(args: CallLogsQueryArgs, user: { clerkId: string; email: string | null }): Promise<Row[]>
  /** Generic read for the supabase-select proxy; `table` must pass `isCallDataTable`. */
  selectRows(table: string, q: SelectQuery): Promise<Row[]>
  countRows(table: string, filters: Filter[]): Promise<number>
}

export interface CallLogMutator {
  insertCallLog(row: Row): Promise<Row>
  insertTurns(rows: Row[]): Promise<void>
  setTranscriptionMetrics(id: string, metrics: Record<string, unknown>): Promise<void>
  /** Deletes the per-turn rows (keyed by call log id) and then the call logs of these agents. */
  deleteCallDataForAgents(agentIds: string[]): Promise<void>
}

export interface QaTicketStore {
  upsertFlagTicket(row: Row): Promise<void>
  findTicketId(callLogId: string, flagId: string): Promise<string | null>
  updatePendingReason(callLogId: string, flagId: string, reason: string): Promise<void>
  deletePending(callLogId: string, flagId: string): Promise<void>
}

export type DncScope = 'global' | 'project' | 'agent'

export interface DncStore {
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
