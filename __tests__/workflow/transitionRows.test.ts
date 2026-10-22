import { describe, expect, it } from 'vitest'
import { cardHeight, transitionRows } from '@/lib/workflow/transitionRows'
import type { Edge } from '@/lib/workflow/schema'

const e = (id: string, source: string, target: string, kind: Edge['kind'], extra: Partial<Edge> = {}) => ({ id, source, target, kind, ...extra }) as Edge

describe('transitionRows', () => {
  it('lists a conversation step with its conditions first and the default way on last', () => {
    const rows = transitionRows({ id: 'a', type: 'conversation' }, [
      e('e1', 'a', 'x', 'fallback'),
      e('e2', 'a', 'y', 'condition', { condition: 'they want to cancel' }),
      e('e3', 'a', 'z', 'always'),
      e('other', 'b', 'z', 'always'),
    ])
    expect(rows.map((r) => [r.edgeId, r.text])).toEqual([
      ['e2', 'they want to cancel'],
      ['e3', 'Next step'],
      ['e1', 'Otherwise'],
    ])
    expect(rows[0].editable).toBe(true)
    expect(rows[1].editable).toBe(false)
  })

  it('always gives a Branch an Else row, even before it is connected', () => {
    const rows = transitionRows({ id: 'b', type: 'logic_split' }, [e('e1', 'b', 'x', 'logic', { expression: 'age > 18' })])
    expect(rows.map((r) => [r.kind, r.text])).toEqual([['logic', 'age > 18'], ['else', 'Else']])
    expect(rows[1].edgeId).toBeNull()
    const connected = transitionRows({ id: 'b', type: 'logic_split' }, [e('e1', 'b', 'x', 'logic', { expression: 'age > 18' }), e('e2', 'b', 'y', 'fallback')])
    expect(connected.map((r) => r.edgeId)).toEqual(['e1', 'e2'])
  })

  it('names the two ways out of a step that can fail', () => {
    const rows = transitionRows({ id: 'f', type: 'function' }, [e('e1', 'f', 'x', 'always'), e('e2', 'f', 'y', 'fallback')])
    expect(rows.map((r) => r.text)).toEqual(['If it works', 'If it fails'])
  })

  it('has no rows for endings and notes', () => {
    expect(transitionRows({ id: 'end', type: 'ending' }, [e('e1', 'end', 'x', 'always')])).toEqual([])
    expect(transitionRows({ id: 'n', type: 'note' }, [])).toEqual([])
  })

  it('makes a card taller for each row', () => {
    expect(cardHeight(0)).toBeLessThan(cardHeight(1))
    expect(cardHeight(3)).toBeGreaterThan(cardHeight(2))
  })
})
