import { describe, it, expect } from 'vitest'
import TraceGroupingEngine, { useTraceGrouping } from '@/utils/trace-grouping-utils'

const makeSpan = (overrides: Partial<{
  trace_id: string
  span_id: string
  parent_span_id: string | null
  name: string
  captured_at: number
  duration_ms: number
  operation_type: string
  session_id: string
  attributes: Record<string, any>
}> = {}) => ({
  trace_id: 'trace-1',
  span_id: 'span-1',
  parent_span_id: null,
  name: 'llm_call',
  captured_at: 1000,
  duration_ms: 200,
  operation_type: 'llm',
  session_id: 'session-1',
  attributes: {},
  ...overrides,
})

describe('TraceGroupingEngine', () => {
  const engine = new TraceGroupingEngine()

  describe('groupSessionSpans', () => {
    it('returns empty arrays for no spans', () => {
      const { traceGroups, orphanedSpans } = engine.groupSessionSpans([])
      expect(traceGroups).toHaveLength(0)
      expect(orphanedSpans).toHaveLength(0)
    })

    it('groups spans by trace_id', () => {
      const spans = [
        makeSpan({ trace_id: 'trace-a', span_id: 'span-1', captured_at: 1000 }),
        makeSpan({ trace_id: 'trace-a', span_id: 'span-2', captured_at: 1100 }),
        makeSpan({ trace_id: 'trace-b', span_id: 'span-3', captured_at: 2000 }),
      ]
      const { traceGroups, orphanedSpans } = engine.groupSessionSpans(spans)
      expect(traceGroups).toHaveLength(2)
      expect(orphanedSpans).toHaveLength(0)
      const traceA = traceGroups.find(t => t.trace_id === 'trace-a')
      expect(traceA?.spans).toHaveLength(2)
    })

    it('puts spans with no trace_id into orphanedSpans', () => {
      const spans = [
        makeSpan({ trace_id: '', span_id: 'orphan-1' }),
        makeSpan({ trace_id: 'trace-1', span_id: 'span-1' }),
      ]
      const { traceGroups, orphanedSpans } = engine.groupSessionSpans(spans)
      expect(orphanedSpans).toHaveLength(1)
      expect(traceGroups).toHaveLength(1)
    })

    it('sorts trace groups chronologically', () => {
      const spans = [
        makeSpan({ trace_id: 'trace-late', span_id: 'sl', captured_at: 5000 }),
        makeSpan({ trace_id: 'trace-early', span_id: 'se', captured_at: 1000 }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      expect(traceGroups[0].trace_id).toBe('trace-early')
      expect(traceGroups[1].trace_id).toBe('trace-late')
    })

    it('calculates span_count correctly', () => {
      const spans = [
        makeSpan({ span_id: 'a', captured_at: 1000 }),
        makeSpan({ span_id: 'b', captured_at: 1100 }),
        makeSpan({ span_id: 'c', captured_at: 1200 }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      expect(traceGroups[0].span_count).toBe(3)
    })

    it('counts error spans', () => {
      const spans = [
        makeSpan({ span_id: 'ok', name: 'llm_call', attributes: {} }),
        makeSpan({ span_id: 'err', name: 'error_event', attributes: {} }),
        makeSpan({ span_id: 'err2', name: 'tts_call', attributes: { error: true } }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      expect(traceGroups[0].error_count).toBeGreaterThanOrEqual(2)
    })

    it('computes duration_ms from span range', () => {
      const spans = [
        makeSpan({ span_id: 'a', captured_at: 1000, duration_ms: 100 }),
        makeSpan({ span_id: 'b', captured_at: 1500, duration_ms: 200 }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      const tg = traceGroups[0]
      expect(tg.duration_ms).toBeGreaterThan(0)
    })

    it('picks root span as the one without a parent', () => {
      const spans = [
        makeSpan({ span_id: 'root', parent_span_id: null, captured_at: 1000 }),
        makeSpan({ span_id: 'child', parent_span_id: 'root', captured_at: 1100 }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      expect(traceGroups[0].root_span.span_id).toBe('root')
    })

    it('falls back to session_start span as root when no parentless span', () => {
      const spans = [
        makeSpan({ span_id: 'a', parent_span_id: 'x', name: 'tts_call', captured_at: 1000 }),
        makeSpan({ span_id: 'b', parent_span_id: 'x', name: 'session_start', captured_at: 900 }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      expect(traceGroups[0].root_span.span_id).toBe('b')
    })

    it('builds operation_summary from span types', () => {
      const spans = [
        makeSpan({ span_id: 'a', operation_type: 'llm', captured_at: 1000 }),
        makeSpan({ span_id: 'b', operation_type: 'tts', captured_at: 1100 }),
        makeSpan({ span_id: 'c', operation_type: 'llm', captured_at: 1200 }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      expect(traceGroups[0].operation_summary).toContain('llm')
      expect(traceGroups[0].operation_summary).toContain('tts')
    })
  })

  describe('matchTracesToTurns', () => {
    const makeTraceGroup = (traceId: string, startTime: number) => {
      const spans = [makeSpan({ trace_id: traceId, captured_at: startTime })]
      const { traceGroups } = engine.groupSessionSpans(spans)
      return traceGroups[0]
    }

    it('returns empty array for no turns', () => {
      const tg = makeTraceGroup('t1', 1000)
      const result = engine.matchTracesToTurns([tg], [])
      expect(result).toHaveLength(1) // unmatched trace becomes its own entry
    })

    it('matches trace to turn within time window', () => {
      const tg = makeTraceGroup('t1', 1000)
      const turns = [{ turn_id: 'turn-1', timestamp: 1010, user_transcript: 'hello', agent_response: 'hi' }]
      const result = engine.matchTracesToTurns([tg], turns, 30)
      const matched = result.find(r => r.turn_id === 'turn-1')
      expect(matched?.matched_traces).toHaveLength(1)
    })

    it('does not match trace outside time window', () => {
      const tg = makeTraceGroup('t1', 1000)
      const turns = [{ turn_id: 'turn-1', timestamp: 2000 }]
      const result = engine.matchTracesToTurns([tg], turns, 5)
      const matched = result.find(r => r.turn_id === 'turn-1')
      expect(matched?.matched_traces).toHaveLength(0)
    })

    it('handles turns with string timestamp', () => {
      const tg = makeTraceGroup('t1', 1000)
      const turns = [{ turn_id: 'turn-1', timestamp: '1970-01-01T00:16:40.000Z' }]
      const result = engine.matchTracesToTurns([tg], turns, 30)
      expect(result).toBeDefined()
    })

    it('handles turns with Date object timestamp', () => {
      const date = new Date(1000 * 1000)
      const tg = makeTraceGroup('t1', 1000)
      const turns = [{ turn_id: 'turn-1', timestamp: date }]
      const result = engine.matchTracesToTurns([tg], turns, 10)
      expect(result).toBeDefined()
    })

    it('does not reuse same trace for multiple turns', () => {
      const tg = makeTraceGroup('t1', 1000)
      const turns = [
        { turn_id: 'turn-1', timestamp: 1005 },
        { turn_id: 'turn-2', timestamp: 1010 },
      ]
      const result = engine.matchTracesToTurns([tg], turns, 30)
      const totalMatched = result.reduce((sum, r) => sum + r.matched_traces.length, 0)
      expect(totalMatched).toBe(1)
    })
  })

  describe('createWaterfallData', () => {
    it('returns zeros for empty input', () => {
      const result = engine.createWaterfallData([])
      expect(result.timelineStart).toBe(0)
      expect(result.timelineEnd).toBe(0)
      expect(result.totalDuration).toBe(0)
      expect(result.waterfallRows).toHaveLength(0)
    })

    it('includes a trace-header row per trace group', () => {
      const spans = [
        makeSpan({ span_id: 'a', captured_at: 1000, duration_ms: 500 }),
        makeSpan({ trace_id: 'trace-2', span_id: 'b', captured_at: 2000, duration_ms: 300 }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      const result = engine.createWaterfallData(traceGroups)
      const headers = result.waterfallRows.filter(r => r.type === 'trace-header')
      expect(headers).toHaveLength(2)
    })

    it('includes span rows in addition to headers', () => {
      const spans = [
        makeSpan({ span_id: 'root', parent_span_id: null, captured_at: 1000, duration_ms: 500 }),
        makeSpan({ span_id: 'child', parent_span_id: 'root', captured_at: 1100, duration_ms: 200 }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      const result = engine.createWaterfallData(traceGroups)
      const spanRows = result.waterfallRows.filter(r => r.type === 'span')
      expect(spanRows.length).toBeGreaterThan(0)
    })

    it('assigns sequential rowIndex values', () => {
      const spans = [makeSpan({ captured_at: 1000, duration_ms: 100 })]
      const { traceGroups } = engine.groupSessionSpans(spans)
      const result = engine.createWaterfallData(traceGroups)
      result.waterfallRows.forEach((row, i) => {
        expect(row.rowIndex).toBe(i)
      })
    })

    it('computes timelineStart and timelineEnd from trace groups', () => {
      const spans = [
        makeSpan({ trace_id: 'early', span_id: 'e', captured_at: 500, duration_ms: 100 }),
        makeSpan({ trace_id: 'late', span_id: 'l', captured_at: 2000, duration_ms: 500 }),
      ]
      const { traceGroups } = engine.groupSessionSpans(spans)
      const result = engine.createWaterfallData(traceGroups)
      expect(result.timelineStart).toBeLessThanOrEqual(500)
      expect(result.timelineEnd).toBeGreaterThanOrEqual(2000)
    })
  })
})

describe('useTraceGrouping', () => {
  it('returns processSessionSpans, matchToTurns, createWaterfall', () => {
    const hooks = useTraceGrouping()
    expect(typeof hooks.processSessionSpans).toBe('function')
    expect(typeof hooks.matchToTurns).toBe('function')
    expect(typeof hooks.createWaterfall).toBe('function')
  })

  it('processSessionSpans delegates to engine correctly', () => {
    const { processSessionSpans } = useTraceGrouping()
    const spans = [makeSpan({ span_id: 'a' }), makeSpan({ span_id: 'b' })]
    const { traceGroups } = processSessionSpans(spans)
    expect(traceGroups).toHaveLength(1)
    expect(traceGroups[0].span_count).toBe(2)
  })

  it('createWaterfall returns waterfall rows', () => {
    const { processSessionSpans, createWaterfall } = useTraceGrouping()
    const spans = [makeSpan({ captured_at: 1000, duration_ms: 200 })]
    const { traceGroups } = processSessionSpans(spans)
    const result = createWaterfall(traceGroups)
    expect(result.waterfallRows.length).toBeGreaterThan(0)
  })
})
