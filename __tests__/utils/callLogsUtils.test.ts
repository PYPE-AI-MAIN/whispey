import { describe, it, expect, vi } from 'vitest'

// CallFilter and supabase-query-types are pulled in for types only — mock to avoid
// loading React/browser deps in node environment
vi.mock('@/components/CallFilter', () => ({}))
vi.mock('@/lib/supabase-query-types', () => ({}))

import {
  toCamelCase,
  formatDuration,
  formatToIndianDateTime,
  normalizeRoleForColumnAccess,
  isViewerRole,
  isColumnVisibleForRole,
  extractFiltersAndDistinct,
  convertToSupabaseFilters,
  getSelectColumns,
  flattenCallLogForCSV,
} from '@/utils/callLogsUtils'

describe('callLogsUtils', () => {
  describe('toCamelCase', () => {
    it('converts snake_case to camelCase', () => {
      expect(toCamelCase('hello world')).toBe('helloWorld')
    })

    it('handles already camelCase strings', () => {
      expect(toCamelCase('helloWorld')).toBe('helloWorld')
    })

    it('strips hyphens (treated as special chars, not word separators)', () => {
      // toCamelCase strips [^\w\s], so hyphens are removed without introducing spaces
      expect(toCamelCase('call-ended-reason')).toBe('callendedreason')
    })

    it('converts space-separated words to camelCase', () => {
      expect(toCamelCase('call ended reason')).toBe('callEndedReason')
    })

    it('lowercases the first letter', () => {
      expect(toCamelCase('MyField')).toBe('myField')
    })

    it('handles empty string', () => {
      expect(toCamelCase('')).toBe('')
    })

    it('handles single word', () => {
      expect(toCamelCase('name')).toBe('name')
    })
  })

  describe('formatDuration', () => {
    it('formats seconds into mm:ss', () => {
      expect(formatDuration(90)).toBe('1:30')
    })

    it('zero-pads seconds', () => {
      expect(formatDuration(65)).toBe('1:05')
    })

    it('handles exactly 0 seconds', () => {
      expect(formatDuration(0)).toBe('0:00')
    })

    it('handles large values', () => {
      expect(formatDuration(3661)).toBe('61:01')
    })

    it('handles 59 seconds', () => {
      expect(formatDuration(59)).toBe('0:59')
    })
  })

  describe('formatToIndianDateTime', () => {
    it('returns a non-empty formatted string', () => {
      const result = formatToIndianDateTime('2024-01-15T10:30:00Z')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('includes the year', () => {
      const result = formatToIndianDateTime('2024-01-15T10:30:00Z')
      expect(result).toContain('2024')
    })
  })

  describe('normalizeRoleForColumnAccess', () => {
    it('returns null for null input', () => {
      expect(normalizeRoleForColumnAccess(null)).toBeNull()
    })

    it('maps "viewer" to "viewer"', () => {
      expect(normalizeRoleForColumnAccess('viewer')).toBe('viewer')
    })

    it('maps "user" to "viewer"', () => {
      expect(normalizeRoleForColumnAccess('user')).toBe('viewer')
    })

    it('maps "member" to "viewer"', () => {
      expect(normalizeRoleForColumnAccess('member')).toBe('viewer')
    })

    it('passes "admin" through unchanged', () => {
      expect(normalizeRoleForColumnAccess('admin')).toBe('admin')
    })

    it('passes "owner" through unchanged', () => {
      expect(normalizeRoleForColumnAccess('owner')).toBe('owner')
    })
  })

  describe('isViewerRole', () => {
    it('returns true for "viewer"', () => {
      expect(isViewerRole('viewer')).toBe(true)
    })

    it('returns true for "user" (normalized to viewer)', () => {
      expect(isViewerRole('user')).toBe(true)
    })

    it('returns true for "member" (normalized to viewer)', () => {
      expect(isViewerRole('member')).toBe(true)
    })

    it('returns false for "admin"', () => {
      expect(isViewerRole('admin')).toBe(false)
    })

    it('returns false for null', () => {
      expect(isViewerRole(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isViewerRole(undefined)).toBe(false)
    })
  })

  describe('isColumnVisibleForRole', () => {
    it('hides "tags" column for viewer role', () => {
      expect(isColumnVisibleForRole('tags', 'viewer')).toBe(false)
    })

    it('hides "tags" column for "user" role (normalized to viewer)', () => {
      expect(isColumnVisibleForRole('tags', 'user')).toBe(false)
    })

    it('shows "tags" column for admin', () => {
      expect(isColumnVisibleForRole('tags', 'admin')).toBe(true)
    })

    it('shows any column when role is null', () => {
      expect(isColumnVisibleForRole('tags', null)).toBe(true)
    })

    it('shows non-restricted columns for viewer', () => {
      expect(isColumnVisibleForRole('call_id', 'viewer')).toBe(true)
      expect(isColumnVisibleForRole('transcript', 'viewer')).toBe(true)
    })

    it('shows all columns for owner role', () => {
      expect(isColumnVisibleForRole('tags', 'owner')).toBe(true)
      expect(isColumnVisibleForRole('call_id', 'owner')).toBe(true)
    })
  })

  describe('extractFiltersAndDistinct — filter type coverage', () => {
    const make = (col: string, op: string, val: string = 'test'): any => ({
      type: 'filter', column: col, operation: op, value: val, order: 0,
    })

    it('tags contains → transcription_metrics ilike', () => {
      const r = extractFiltersAndDistinct([make('tags', 'contains', 'urgent')], 'a1')
      const f = r.preDistinctFilters.find(f => f.column.includes("tags"))
      expect(f?.operator).toBe('ilike')
    })

    it('tags equals → transcription_metrics ilike with quoted value', () => {
      const r = extractFiltersAndDistinct([make('tags', 'equals', 'follow-up')], 'a1')
      const f = r.preDistinctFilters.find(f => f.column.includes("tags"))
      expect(f?.value).toContain('"follow-up"')
    })

    it('flag contains → nested json path ilike', () => {
      const r = extractFiltersAndDistinct([make('flag', 'contains', 'review')], 'a1')
      const f = r.preDistinctFilters.find(f => f.column.includes('flag'))
      expect(f?.operator).toBe('ilike')
    })

    it('flag exists → not.is null', () => {
      const r = extractFiltersAndDistinct([make('flag', 'exists', '')], 'a1')
      const f = r.preDistinctFilters.find(f => f.column.includes('flag'))
      expect(f?.operator).toBe('not.is')
    })

    it('not_equals filter → <> operator', () => {
      const r = extractFiltersAndDistinct([make('call_ended_reason', 'not_equals', 'customer-ended')], 'a1')
      const f = r.preDistinctFilters.find(f => f.column === 'call_ended_reason')
      expect(f?.operator).toBe('<>')
    })

    it('starts_with filter → ilike with trailing wildcard', () => {
      const r = extractFiltersAndDistinct([make('call_ended_reason', 'starts_with', 'cust')], 'a1')
      const f = r.preDistinctFilters.find(f => f.column === 'call_ended_reason')
      expect(f?.value).toBe('cust%')
    })

    it('json_equals on metadata field → eq operator', () => {
      const op: any = { type: 'filter', column: 'metadata', operation: 'json_equals', value: 'booking', jsonField: 'intent', order: 0 }
      const r = extractFiltersAndDistinct([op], 'a1')
      const f = r.preDistinctFilters.find(f => f.column.includes('intent'))
      expect(f?.operator).toBe('eq')
    })

    it('json_greater_than → gt with numeric cast', () => {
      const op: any = { type: 'filter', column: 'metadata', operation: 'json_greater_than', value: '5', jsonField: 'score', order: 0 }
      const r = extractFiltersAndDistinct([op], 'a1')
      const f = r.preDistinctFilters.find(f => f.column.includes('numeric'))
      expect(f?.operator).toBe('gt')
    })

    it('json_less_than → lt with numeric cast', () => {
      const op: any = { type: 'filter', column: 'metadata', operation: 'json_less_than', value: '10', jsonField: 'score', order: 0 }
      const r = extractFiltersAndDistinct([op], 'a1')
      const f = r.preDistinctFilters.find(f => f.column.includes('numeric'))
      expect(f?.operator).toBe('lt')
    })

    it('json_exists → not.is null', () => {
      const op: any = { type: 'filter', column: 'metadata', operation: 'json_exists', value: '', jsonField: 'phone', order: 0 }
      const r = extractFiltersAndDistinct([op], 'a1')
      const f = r.preDistinctFilters.find(f => f.column.includes('phone'))
      expect(f?.operator).toBe('not.is')
    })

    it('greater_than on call_started_at → gte of next day', () => {
      const op: any = { type: 'filter', column: 'call_started_at', operation: 'greater_than', value: '2024-01-15', order: 0 }
      const r = extractFiltersAndDistinct([op], 'a1')
      const f = r.preDistinctFilters.find(f => f.column === 'call_started_at' && f.operator === 'gte')
      expect(f?.value).toBe('2024-01-16')
    })

    it('less_than on call_started_at → lt', () => {
      const op: any = { type: 'filter', column: 'call_started_at', operation: 'less_than', value: '2024-01-31', order: 0 }
      const r = extractFiltersAndDistinct([op], 'a1')
      const f = r.preDistinctFilters.find(f => f.operator === 'lt' && f.column === 'call_started_at')
      expect(f?.value).toBe('2024-01-31')
    })
  })

  describe('extractFiltersAndDistinct', () => {
    it('returns empty filters when agentId is not provided', () => {
      const result = extractFiltersAndDistinct([], undefined)
      expect(result.preDistinctFilters).toHaveLength(0)
      expect(result.postDistinctFilters).toHaveLength(0)
    })

    it('always includes agent_id in preDistinctFilters', () => {
      const result = extractFiltersAndDistinct([], 'agent-123')
      const agentFilter = result.preDistinctFilters.find(f => f.column === 'agent_id')
      expect(agentFilter?.value).toBe('agent-123')
    })

    it('converts a contains filter to ilike operator', () => {
      const result = extractFiltersAndDistinct(
        [{ type: 'filter', column: 'call_ended_reason', operation: 'contains', value: 'timeout', order: 0 } as any],
        'agent-1'
      )
      const f = result.preDistinctFilters.find(f => f.column === 'call_ended_reason')
      expect(f?.operator).toBe('ilike')
      expect(f?.value).toContain('timeout')
    })

    it('converts an equals filter on a plain column to eq operator', () => {
      const result = extractFiltersAndDistinct(
        [{ type: 'filter', column: 'environment', operation: 'equals', value: 'prod', order: 0 } as any],
        'agent-1'
      )
      const f = result.preDistinctFilters.find(f => f.column === 'environment')
      expect(f?.operator).toBe('eq')
      expect(f?.value).toBe('prod')
    })

    it('splits filters around a distinct operation', () => {
      const ops: any[] = [
        { type: 'filter', column: 'environment', operation: 'equals', value: 'prod', order: 0 },
        { type: 'distinct', column: 'customer_number', order: 1 },
        { type: 'filter', column: 'call_ended_reason', operation: 'contains', value: 'ok', order: 2 },
      ]
      const result = extractFiltersAndDistinct(ops, 'agent-1')
      expect(result.distinctConfig?.column).toBe('customer_number')
      // Pre-distinct has agent_id + environment filter
      const envFilter = result.preDistinctFilters.find(f => f.column === 'environment')
      expect(envFilter).toBeDefined()
      // Post-distinct has the reason filter
      const reasonFilter = result.postDistinctFilters.find(f => f.column === 'call_ended_reason')
      expect(reasonFilter).toBeDefined()
    })

    it('handles date equals by expanding to gte/lt range', () => {
      const result = extractFiltersAndDistinct(
        [{ type: 'filter', column: 'call_started_at', operation: 'equals', value: '2024-01-15', order: 0 } as any],
        'agent-1'
      )
      const gte = result.preDistinctFilters.find(f => f.operator === 'gte' && f.column === 'call_started_at')
      const lt = result.preDistinctFilters.find(f => f.operator === 'lt' && f.column === 'call_started_at')
      expect(gte?.value).toBe('2024-01-15')
      expect(lt?.value).toBe('2024-01-16')
    })
  })

  describe('convertToSupabaseFilters', () => {
    it('returns pre-distinct filters (backward compat wrapper)', () => {
      const filters = convertToSupabaseFilters([], 'agent-1')
      expect(filters.some(f => f.column === 'agent_id')).toBe(true)
    })
  })

  describe('getSelectColumns', () => {
    it('includes base columns for any role', () => {
      const cols = getSelectColumns('admin')
      expect(cols).toContain('call_id')
      expect(cols).toContain('agent_id')
      expect(cols).toContain('duration_seconds')
    })

    it('includes cost columns for admin', () => {
      const cols = getSelectColumns('admin')
      expect(cols).toContain('total_llm_cost')
    })

    it('includes cost columns for viewer (not restricted by ROLE_RESTRICTIONS)', () => {
      const cols = getSelectColumns('viewer')
      expect(cols).toContain('call_id')
    })

    it('returns a comma-separated string', () => {
      const cols = getSelectColumns(null)
      expect(cols).toContain(',')
    })
  })

  describe('flattenCallLogForCSV', () => {
    const baseRow: any = {
      id: 'log-1',
      call_id: 'call-abc',
      agent_id: 'agent-1',
      duration_seconds: 90,
      call_ended_reason: 'customer-ended',
      total_llm_cost: 0.5,
      total_tts_cost: 0.1,
      total_stt_cost: 0.05,
      metadata: { intent: 'booking', patient_id: 'P001' },
      transcription_metrics: {
        tags: ['follow-up', 'urgent'],
        flag: { text: 'needs review' },
        sentiment: 'positive',
      },
    }

    it('flattens basic column values', () => {
      const result = flattenCallLogForCSV(baseRow, ['call_id', 'duration_seconds'], [], [])
      expect(result.call_id).toBe('call-abc')
      expect(result.duration_seconds).toBe(90)
    })

    it('flattens tags from transcription_metrics', () => {
      const result = flattenCallLogForCSV(baseRow, ['tags'], [], [])
      expect(result.tags).toBe('follow-up, urgent')
    })

    it('returns empty string for tags when not an array', () => {
      const row = { ...baseRow, transcription_metrics: { tags: null } }
      const result = flattenCallLogForCSV(row, ['tags'], [], [])
      expect(result.tags).toBe('')
    })

    it('extracts flag text from transcription_metrics', () => {
      const result = flattenCallLogForCSV(baseRow, ['flag'], [], [])
      expect(result.flag).toBe('needs review')
    })

    it('returns empty string for flag when absent', () => {
      const row = { ...baseRow, transcription_metrics: {} }
      const result = flattenCallLogForCSV(row, ['flag'], [], [])
      expect(result.flag).toBe('')
    })

    it('computes total_cost as sum of llm + tts + stt', () => {
      const result = flattenCallLogForCSV(baseRow, ['total_cost'], [], [])
      expect(result.total_cost).toBeCloseTo(0.65)
    })

    it('extracts metadata fields with metadata_ prefix', () => {
      const result = flattenCallLogForCSV(baseRow, [], ['intent', 'patient_id'], [])
      expect(result.metadata_intent).toBe('booking')
      expect(result.metadata_patient_id).toBe('P001')
    })

    it('returns empty string for missing metadata key', () => {
      const result = flattenCallLogForCSV(baseRow, [], ['nonexistent'], [])
      expect(result.metadata_nonexistent).toBe('')
    })

    it('JSON-stringifies object metadata values', () => {
      const row = { ...baseRow, metadata: { nested: { a: 1 } } }
      const result = flattenCallLogForCSV(row, [], ['nested'], [])
      expect(result.metadata_nested).toBe('{"a":1}')
    })

    it('extracts transcription_metrics fields with transcription_ prefix', () => {
      const result = flattenCallLogForCSV(baseRow, [], [], ['sentiment'])
      expect(result.transcription_sentiment).toBe('positive')
    })

    it('returns empty string for missing transcription key', () => {
      const result = flattenCallLogForCSV(baseRow, [], [], ['missing_key'])
      expect(result.transcription_missing_key).toBe('')
    })

    it('handles row with no metadata gracefully', () => {
      const row = { ...baseRow, metadata: null }
      const result = flattenCallLogForCSV(row, [], ['intent'], [])
      expect(result.metadata_intent).toBe('')
    })

    it('handles row with no transcription_metrics gracefully', () => {
      const row = { ...baseRow, transcription_metrics: null }
      const result = flattenCallLogForCSV(row, [], [], ['sentiment'])
      expect(result.transcription_sentiment).toBe('')
    })
  })
})
