/**
 * In-memory DataPlane for route tests. Tables are keyed by whatever name the
 * port is given, so this file holds no table names. `calls` records every port
 * call so tests can assert a route never touched another project's plane.
 */
import type { DataPlane, Row } from '../ports'

export interface FakePlane extends DataPlane {
  rows: Map<string, Row[]>
  calls: string[]
}

export function createFakePlane(seed: Record<string, Row[]> = {}): FakePlane {
  const rows = new Map(Object.entries(seed))
  const calls: string[] = []
  const t = (name: string) => rows.get(name) ?? rows.set(name, []).get(name)!
  const log = <T>(name: string, v: T): T => {
    calls.push(name)
    return v
  }
  const CALL_LOGS = 'call_logs'
  const TURNS = 'turns'
  const TICKETS = 'tickets'

  const plane: FakePlane = {
    rows,
    calls,
    callData: {
      async countCallLogs(q) { return log('countCallLogs', t(CALL_LOGS).filter((r) => q.agentIds.includes(r.agent_id)).length) },
      async getCallLog(id) { return log('getCallLog', t(CALL_LOGS).find((r) => r.id === id) ?? null) },
      async findCallLogs(agentId, ids) { return log('findCallLogs', t(CALL_LOGS).filter((r) => r.agent_id === agentId && ids.includes(r.id))) },
      async listCampaignCalls(agentId, campaignId, nums) {
        return log('listCampaignCalls', t(CALL_LOGS).filter((r) => r.agent_id === agentId && r.metadata?.campaignId === campaignId && nums.includes(r.customer_number)))
      },
      async listTurns(sessionId) { return log('listTurns', t(TURNS).filter((r) => r.session_id === sessionId)) },
      async campaignGroupedCallLogs() { return log('campaignGroupedCallLogs', []) },
      async queryCallLogs(args) { return log('queryCallLogs', t(CALL_LOGS).filter((r) => r.agent_id === args.p_agent_id)) },
      async selectRows(table) { return log('selectRows', [...t(table)]) },
      async countRows(table) { return log('countRows', t(table).length) },
    },
    callLogs: {
      async insertCallLog(row) { const r = { id: `log-${t(CALL_LOGS).length + 1}`, ...row }; t(CALL_LOGS).push(r); return log('insertCallLog', r) },
      async insertTurns(r) { t(TURNS).push(...r); log('insertTurns', 0) },
      async setTranscriptionMetrics(id, metrics) {
        const row = t(CALL_LOGS).find((r) => r.id === id)
        if (row) row.transcription_metrics = metrics
        log('setTranscriptionMetrics', 0)
      },
      async deleteCallDataForAgents(agentIds) {
        const gone = new Set(t(CALL_LOGS).filter((r) => agentIds.includes(r.agent_id)).map((r) => r.id))
        rows.set(TURNS, t(TURNS).filter((r) => !gone.has(r.session_id)))
        rows.set(CALL_LOGS, t(CALL_LOGS).filter((r) => !gone.has(r.id)))
        log('deleteCallDataForAgents', 0)
      },
    },
    qa: {
      async upsertFlagTicket(row) {
        if (!t(TICKETS).some((r) => r.call_log_id === row.call_log_id && r.flag_id === row.flag_id)) t(TICKETS).push({ id: `t-${t(TICKETS).length + 1}`, status: 'pending', ...row })
        log('upsertFlagTicket', 0)
      },
      async findTicketId(callLogId, flagId) { return log('findTicketId', t(TICKETS).find((r) => r.call_log_id === callLogId && r.flag_id === flagId)?.id ?? null) },
      async updatePendingReason(callLogId, flagId, reason) {
        t(TICKETS).filter((r) => r.call_log_id === callLogId && r.flag_id === flagId && r.status === 'pending').forEach((r) => (r.reason = reason))
        log('updatePendingReason', 0)
      },
      async deletePending(callLogId, flagId) {
        rows.set(TICKETS, t(TICKETS).filter((r) => !(r.call_log_id === callLogId && r.flag_id === flagId && r.status === 'pending')))
        log('deletePending', 0)
      },
    },
    dnc: { async findBlocked() { return log('findBlocked', []) } },
    storage: { async signRecordingUrl(key) { return log('signRecordingUrl', `https://fake.test/${key}`) } },
  }
  return plane
}
