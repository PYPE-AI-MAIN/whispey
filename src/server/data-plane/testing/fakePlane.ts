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
  const DNC = 'dnc'

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
      async analyticsRows(q) { return log('analyticsRows', t(CALL_LOGS).filter((r) => q.agentIds.includes(r.agent_id) && r.call_started_at >= q.from && r.call_started_at < q.to)) },
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
      async listTickets(agentId, q) {
        const all = t(TICKETS).filter((r) => r.agent_id === agentId && (!q.status || r.status === q.status))
        return log('listTickets', { rows: all.slice(q.from, q.to + 1), total: all.length })
      },
      async countByStatus(agentId, statuses) {
        return log('countByStatus', Object.fromEntries(statuses.map((s) => [s, t(TICKETS).filter((r) => r.agent_id === agentId && r.status === s).length])))
      },
      async getTicket(id) { return log('getTicket', t(TICKETS).find((r) => r.id === id) ?? null) },
      async updateTicket(id, patch) {
        const row = t(TICKETS).find((r) => r.id === id)!
        Object.assign(row, patch)
        return log('updateTicket', row)
      },
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
    dnc: {
      async findBlocked(phones, projectId, agentId) {
        return log('findBlocked', t(DNC).filter((r) => r.is_active && phones.includes(r.phone_e164) && (r.scope === 'global' || (r.scope === 'project' && r.project_id === projectId) || (r.scope === 'agent' && r.agent_id === agentId))).map((r) => ({ phone_e164: r.phone_e164, scope: r.scope })))
      },
      async listEntries(q) {
        const rows = t(DNC).filter((r) => r.is_active && (!q.scope || r.scope === q.scope) && (!q.projectId || r.project_id === q.projectId) && (!q.agentId || r.agent_id === q.agentId))
        return log('listEntries', { rows: rows.slice(0, q.limit), total: rows.length })
      },
      async findActive(phones, scope, projectId, agentId) {
        return log('findActive', t(DNC).filter((r) => r.is_active && r.scope === scope && phones.includes(r.phone_e164) && (scope !== 'project' || r.project_id === projectId) && (scope !== 'agent' || r.agent_id === agentId)).map((r) => r.phone_e164))
      },
      async addEntries(r) { t(DNC).push(...r.map((x, i) => ({ id: `d-${t(DNC).length + i + 1}`, ...x }))); log('addEntries', 0) },
      async deactivate(id) { t(DNC).filter((r) => r.id === id).forEach((r) => (r.is_active = false)); log('deactivate', 0) },
    },
    storage: { async signRecordingUrl(key) { return log('signRecordingUrl', `https://fake.test/${key}`) } },
  }
  return plane
}
