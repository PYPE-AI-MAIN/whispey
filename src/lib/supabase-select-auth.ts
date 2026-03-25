import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { NextResponse } from 'next/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_TABLES = new Set([
  'pype_voice_projects',
  'pype_voice_agents',
  'pype_voice_call_logs',
  'pype_voice_metrics_logs',
  'pype_voice_session_traces',
  'pype_voice_spans',
  'pype_voice_metric_groups',
  'pype_voice_custom_totals_configs',
])

export function isAllowedTable(table: string): boolean {
  return ALLOWED_TABLES.has(table)
}

type Filter = { column: string; operator: string; value: unknown }

export async function authorizeTableSelect(
  table: string,
  filters: Filter[] | undefined,
  authHint?: { agentId?: string; projectId?: string }
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (authHint?.agentId && UUID_RE.test(authHint.agentId)) {
    const supabase = createServiceRoleClient()
    const { data: agent } = await supabase
      .from('pype_voice_agents')
      .select('project_id')
      .eq('id', authHint.agentId)
      .maybeSingle()
    if (!agent?.project_id) {
      return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    const role = await getProjectRoleForApi(agent.project_id as string)
    if (!role) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    return { ok: true }
  }

  if (authHint?.projectId && UUID_RE.test(authHint.projectId)) {
    const role = await getProjectRoleForApi(authHint.projectId)
    if (!role) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    return { ok: true }
  }

  const list = filters || []
  for (const f of list) {
    if (f.operator === 'eq' && f.column === 'agent_id' && typeof f.value === 'string' && UUID_RE.test(f.value)) {
      const supabase = createServiceRoleClient()
      const { data: agent } = await supabase
        .from('pype_voice_agents')
        .select('project_id')
        .eq('id', f.value)
        .maybeSingle()
      if (agent?.project_id) {
        const role = await getProjectRoleForApi(agent.project_id as string)
        if (!role) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
        return { ok: true }
      }
    }
    if (f.operator === 'eq' && f.column === 'project_id' && typeof f.value === 'string' && UUID_RE.test(f.value)) {
      const role = await getProjectRoleForApi(f.value)
      if (!role) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
      return { ok: true }
    }
    if (
      table === 'pype_voice_projects' &&
      f.operator === 'eq' &&
      f.column === 'id' &&
      typeof f.value === 'string' &&
      UUID_RE.test(f.value)
    ) {
      const role = await getProjectRoleForApi(f.value)
      if (!role) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
      return { ok: true }
    }
    if (
      table === 'pype_voice_call_logs' &&
      f.operator === 'eq' &&
      f.column === 'id' &&
      typeof f.value === 'string' &&
      UUID_RE.test(f.value)
    ) {
      const supabase = createServiceRoleClient()
      const { data: log } = await supabase
        .from('pype_voice_call_logs')
        .select('agent_id')
        .eq('id', f.value)
        .maybeSingle()
      if (log?.agent_id) {
        const { data: agent } = await supabase
          .from('pype_voice_agents')
          .select('project_id')
          .eq('id', log.agent_id)
          .maybeSingle()
        if (agent?.project_id) {
          const role = await getProjectRoleForApi(agent.project_id as string)
          if (!role) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
          return { ok: true }
        }
      }
    }
    if (
      table === 'pype_voice_session_traces' &&
      f.operator === 'eq' &&
      f.column === 'session_id' &&
      typeof f.value === 'string' &&
      UUID_RE.test(f.value)
    ) {
      const supabase = createServiceRoleClient()
      const { data: log } = await supabase
        .from('pype_voice_call_logs')
        .select('agent_id')
        .eq('id', f.value)
        .maybeSingle()
      if (log?.agent_id) {
        const { data: agent } = await supabase
          .from('pype_voice_agents')
          .select('project_id')
          .eq('id', log.agent_id)
          .maybeSingle()
        if (agent?.project_id) {
          const role = await getProjectRoleForApi(agent.project_id as string)
          if (!role) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
          return { ok: true }
        }
      }
    }
    if (
      table === 'pype_voice_metrics_logs' &&
      f.operator === 'eq' &&
      f.column === 'session_id' &&
      typeof f.value === 'string' &&
      UUID_RE.test(f.value)
    ) {
      const supabase = createServiceRoleClient()
      const { data: log } = await supabase
        .from('pype_voice_call_logs')
        .select('agent_id')
        .eq('id', f.value)
        .maybeSingle()
      if (log?.agent_id) {
        const { data: agent } = await supabase
          .from('pype_voice_agents')
          .select('project_id')
          .eq('id', log.agent_id)
          .maybeSingle()
        if (agent?.project_id) {
          const role = await getProjectRoleForApi(agent.project_id as string)
          if (!role) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
          return { ok: true }
        }
      }
    }
    if (
      table === 'pype_voice_spans' &&
      f.operator === 'eq' &&
      f.column === 'id' &&
      typeof f.value === 'string' &&
      UUID_RE.test(f.value)
    ) {
      const supabase = createServiceRoleClient()
      const { data: sp } = await supabase
        .from('pype_voice_spans')
        .select('trace_key')
        .eq('id', f.value)
        .maybeSingle()
      if (sp?.trace_key) {
        const { data: st } = await supabase
          .from('pype_voice_session_traces')
          .select('session_id')
          .eq('trace_key', sp.trace_key as string)
          .maybeSingle()
        if (st?.session_id) {
          const { data: log } = await supabase
            .from('pype_voice_call_logs')
            .select('agent_id')
            .eq('id', st.session_id as string)
            .maybeSingle()
          if (log?.agent_id) {
            const { data: agent } = await supabase
              .from('pype_voice_agents')
              .select('project_id')
              .eq('id', log.agent_id)
              .maybeSingle()
            if (agent?.project_id) {
              const role = await getProjectRoleForApi(agent.project_id as string)
              if (!role) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
              return { ok: true }
            }
          }
        }
      }
    }
  }

  return { ok: false, response: NextResponse.json({ error: 'Missing authorization context' }, { status: 403 }) }
}
