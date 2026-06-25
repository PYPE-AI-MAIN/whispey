import { describe, it, expect } from 'vitest'
import { buildCustomTotalExportFilters } from '@/utils/customTotalExportFilters'
import type { CustomTotalConfig } from '@/types/customTotals'

const baseConfig = (): CustomTotalConfig => ({
  aggregation: 'SUM',
  column: 'duration_seconds',
  filters: [],
  filterLogic: 'AND',
} as any)

describe('buildCustomTotalExportFilters', () => {
  it('always includes agent_id filter', () => {
    const { andFilters } = buildCustomTotalExportFilters(baseConfig(), 'agent-1')
    const af = andFilters.find(f => f.column === 'agent_id')
    expect(af).toBeDefined()
    expect(af?.value).toBe('agent-1')
  })

  it('adds dateFrom filter when provided', () => {
    const { andFilters } = buildCustomTotalExportFilters(baseConfig(), 'a1', '2024-01-01')
    const df = andFilters.find(f => f.column === 'call_started_at' && f.operator === 'gte')
    expect(df?.value).toBe('2024-01-01 00:00:00')
  })

  it('adds dateTo filter when provided', () => {
    const { andFilters } = buildCustomTotalExportFilters(baseConfig(), 'a1', undefined, '2024-01-31')
    const dt = andFilters.find(f => f.column === 'call_started_at' && f.operator === 'lte')
    expect(dt?.value).toBe('2024-01-31 23:59:59.999')
  })

  it('does not add date filters when not provided', () => {
    const { andFilters } = buildCustomTotalExportFilters(baseConfig(), 'a1')
    const dateCols = andFilters.filter(f => f.column === 'call_started_at')
    expect(dateCols).toHaveLength(0)
  })

  it('returns null orString when no filters exist', () => {
    const { orString } = buildCustomTotalExportFilters(baseConfig(), 'a1')
    expect(orString).toBeNull()
  })

  it('applies AND filter for equals operation', () => {
    const config = {
      ...baseConfig(),
      filters: [{ column: 'status', operation: 'equals', value: 'completed' }],
      filterLogic: 'AND',
    } as any
    const { andFilters, orString } = buildCustomTotalExportFilters(config, 'a1')
    const statusFilter = andFilters.find(f => f.column === 'status')
    expect(statusFilter?.operator).toBe('eq')
    expect(statusFilter?.value).toBe('completed')
    expect(orString).toBeNull()
  })

  it('builds orString for OR filter logic with contains', () => {
    const config = {
      ...baseConfig(),
      filters: [{ column: 'status', operation: 'contains', value: 'fail' }],
      filterLogic: 'OR',
    } as any
    const { orString } = buildCustomTotalExportFilters(config, 'a1')
    expect(orString).toBeTruthy()
    expect(orString).toContain('ilike')
  })

  it('handles json field name for COUNT_DISTINCT', () => {
    const config = {
      ...baseConfig(),
      aggregation: 'COUNT_DISTINCT',
      column: 'transcription_metrics',
      jsonField: 'intent',
      filters: [],
      filterLogic: 'AND',
    } as any
    const { andFilters } = buildCustomTotalExportFilters(config, 'a1')
    const existsFilter = andFilters.find(f => f.column.includes('intent') && f.operator === 'not.is')
    expect(existsFilter).toBeDefined()
  })
})
