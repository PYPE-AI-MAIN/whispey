import type { CustomTotalConfig } from '@/types/customTotals'

/** Builds PostgREST-style filters for custom total CSV export (server + client). */
export function buildCustomTotalExportFilters(
  config: CustomTotalConfig,
  agentId: string,
  dateFrom?: string,
  dateTo?: string
): { andFilters: { column: string; operator: string; value: unknown }[]; orString: string | null } {
  const andFilters: { column: string; operator: string; value: unknown }[] = []

  andFilters.push({ column: 'agent_id', operator: 'eq', value: agentId })
  if (dateFrom) andFilters.push({ column: 'call_started_at', operator: 'gte', value: `${dateFrom} 00:00:00` })
  if (dateTo) andFilters.push({ column: 'call_started_at', operator: 'lte', value: `${dateTo} 23:59:59.999` })

  const getColumnName = (col: string, jsonField?: string, forText?: boolean) => {
    if (!jsonField) return col
    return `${col}${forText ? '->>' : '->'}${jsonField}`
  }

  if (
    (config.aggregation === 'COUNT' || (config.aggregation === 'COUNT_DISTINCT' && !!config.jsonField)) &&
    config.jsonField
  ) {
    const existsCol = getColumnName(config.column, config.jsonField, true)
    andFilters.push({ column: existsCol, operator: 'not.is', value: null })
    andFilters.push({ column: existsCol, operator: 'neq', value: '' })
  }

  const isTextOp = (op: string) =>
    ['contains', 'json_contains', 'equals', 'json_equals', 'starts_with'].includes(op)

  const toSimpleCond = (f: CustomTotalConfig['filters'][number]) => {
    const col = getColumnName(f.column, f.jsonField, isTextOp(f.operation))
    switch (f.operation) {
      case 'equals':
      case 'json_equals':
        return { column: col, operator: 'eq', value: f.value }
      case 'contains':
      case 'json_contains':
        return { column: col, operator: 'ilike', value: `%${f.value}%` }
      case 'starts_with':
        return { column: col, operator: 'ilike', value: `${f.value}%` }
      case 'greater_than':
      case 'json_greater_than':
        return { column: col.includes('->') ? `${col}::numeric` : col, operator: 'gt', value: f.value }
      case 'less_than':
      case 'json_less_than':
        return { column: col.includes('->') ? `${col}::numeric` : col, operator: 'lt', value: f.value }
      case 'json_exists': {
        return { column: col, operator: 'json_exists', value: null }
      }
      default:
        return null
    }
  }

  const filters = (config.filters || []).map(toSimpleCond).filter(Boolean) as {
    column: string
    operator: string
    value: unknown
  }[]

  let orString: string | null = null
  if (config.filterLogic === 'OR' && filters.length > 0) {
    const parts = filters.map((f) => {
      if (f.operator === 'json_exists') {
        return `and(${f.column}.not.is.null,${f.column}.neq.)`
      }
      if (f.operator === 'eq') return `${f.column}.eq.${encodeURIComponent(String(f.value))}`
      if (f.operator === 'ilike')
        return `${f.column}.ilike.*${encodeURIComponent(String(f.value).replace(/%/g, ''))}*`
      if (f.operator === 'gt') return `${f.column}.gt.${encodeURIComponent(String(f.value))}`
      if (f.operator === 'lt') return `${f.column}.lt.${encodeURIComponent(String(f.value))}`
      return ''
    }).filter(Boolean)
    orString = parts.join(',') || null
  } else {
    for (const f of filters) {
      if (f.operator === 'json_exists') {
        andFilters.push({ column: f.column, operator: 'not.is', value: null })
        andFilters.push({ column: f.column, operator: 'neq', value: '' })
      } else {
        andFilters.push(f)
      }
    }
  }

  return { andFilters, orString }
}
