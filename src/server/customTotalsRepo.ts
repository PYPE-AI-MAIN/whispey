import { createServiceRoleClient } from '@/lib/supabase-server'
import type { CustomTotalConfig, CustomTotalResult } from '@/types/customTotals'

const db = () => createServiceRoleClient()

const RETRYABLE_PLAN_MISMATCH_MESSAGE = 'does not match that when preparing the plan'

function isRetryablePlanMismatch(errorMessage: string): boolean {
  return errorMessage.toLowerCase().includes(RETRYABLE_PLAN_MISMATCH_MESSAGE)
}

export async function saveCustomTotal(
  config: CustomTotalConfig,
  projectId: string,
  agentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await db()
      .from('pype_voice_custom_totals_configs')
      .insert({
        project_id: projectId,
        agent_id: agentId,
        name: config.name,
        description: config.description,
        aggregation: config.aggregation,
        column_name: config.column,
        json_field: config.jsonField,
        distinct_config: config.distinct || null,
        filters: config.filters,
        filter_logic: config.filterLogic,
        icon: config.icon,
        color: config.color,
        created_by: config.createdBy,
      })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to save custom total' }
  }
}

export async function getCustomTotals(projectId: string, agentId: string): Promise<CustomTotalConfig[]> {
  const { data, error } = await db()
    .from('pype_voice_custom_totals_configs')
    .select('*')
    .eq('project_id', projectId)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    aggregation: row.aggregation as CustomTotalConfig['aggregation'],
    column: row.column_name as string,
    jsonField: row.json_field as string | undefined,
    distinct: (row.distinct_config as CustomTotalConfig['distinct']) || undefined,
    filters:
      typeof row.filters === 'string'
        ? JSON.parse(row.filters as string) || []
        : ((row.filters as CustomTotalConfig['filters']) || []),
    filterLogic: row.filter_logic === 'OR' ? 'OR' : 'AND',
    icon: (row.icon as string) || 'calculator',
    color: (row.color as string) || 'blue',
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }))
}

export async function calculateCustomTotal(
  config: CustomTotalConfig,
  agentId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<CustomTotalResult> {
  const jsonField = config.jsonField && config.jsonField.trim() !== '' ? config.jsonField : null
  const rpcParams = {
    p_agent_id: agentId,
    p_aggregation: config.aggregation,
    p_column_name: config.column,
    p_json_field: jsonField,
    p_filters: config.filters,
    p_filter_logic: config.filterLogic,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_distinct_config: config.distinct || null,
  }

  let data: unknown
  let errorMessage: string | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: rpcData, error } = await db().rpc('calculate_custom_total', rpcParams)
    if (!error) {
      data = rpcData
      errorMessage = null
      break
    }

    errorMessage = error.message
    if (!isRetryablePlanMismatch(errorMessage) || attempt === 1) {
      break
    }
  }

  if (errorMessage) {
    return { configId: config.id, value: 0, label: config.name, error: errorMessage }
  }
  const result = (data as Array<{ result?: number; error_message?: string }> | undefined)?.[0]
  if (result?.error_message) {
    return { configId: config.id, value: 0, label: config.name, error: result.error_message }
  }
  return { configId: config.id, value: result?.result || 0, label: config.name }
}

export async function batchCalculateCustomTotals(
  configs: CustomTotalConfig[],
  agentId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<CustomTotalResult[]> {
  if (configs.length === 0) return []
  const rpcConfigs = configs.map((config) => ({
    id: config.id,
    aggregation: config.aggregation,
    column: config.column,
    jsonField: config.jsonField || null,
    distinct: config.distinct || null,
    filters: config.filters,
    filterLogic: config.filterLogic,
  }))

  const { data, error } = await db().rpc('batch_calculate_custom_totals', {
    p_agent_id: agentId,
    p_configs: rpcConfigs,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
  })

  if (error) {
    return configs.map((config) => ({
      configId: config.id,
      value: 0,
      label: config.name,
      error: error.message,
    }))
  }

  return (data as any[]).map((result) => {
    const config = configs.find((c) => c.id === result.config_id)
    return {
      configId: result.config_id,
      value: result.result || 0,
      label: config?.name || 'Unknown',
      error: result.error_message || undefined,
    }
  })
}

export async function deleteCustomTotal(configId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await db().from('pype_voice_custom_totals_configs').delete().eq('id', configId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateCustomTotal(
  configId: string,
  updates: Partial<CustomTotalConfig>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db()
    .from('pype_voice_custom_totals_configs')
    .update({
      name: updates.name,
      description: updates.description,
      aggregation: updates.aggregation,
      column_name: updates.column,
      json_field: updates.jsonField,
      distinct_config: updates.distinct || null,
      filters: updates.filters,
      filter_logic: updates.filterLogic,
      icon: updates.icon,
      color: updates.color,
      updated_at: new Date().toISOString(),
    })
    .eq('id', configId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
