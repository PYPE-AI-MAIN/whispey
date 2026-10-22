import { describe, expect, it } from 'vitest'
import { planConnection } from '@/lib/workflow/connect'
import type { Edge, Workflow } from '@/lib/workflow/schema'

const nodes = [
  { id: 'talk', type: 'conversation' },
  { id: 'split', type: 'logic_split' },
  { id: 'a', type: 'ending' },
  { id: 'b', type: 'ending' },
] as Workflow['nodes']
const edges = [{ id: 'e1', source: 'talk', target: 'a', kind: 'condition', condition: 'they want to cancel' }] as Edge[]

describe('planConnection', () => {
  it('moves a line that is already on the card, keeping its words', () => {
    expect(planConnection({ nodes, edges }, { source: 'talk', target: 'b', sourceHandle: 'e1' }, 'new')).toEqual({ action: 'retarget', edgeId: 'e1', target: 'b' })
  })

  it("turns a Branch's Else into its otherwise connection", () => {
    expect(planConnection({ nodes, edges }, { source: 'split', target: 'a', sourceHandle: 'else' }, 'new')).toEqual({
      action: 'add',
      edge: { id: 'new', source: 'split', target: 'a', kind: 'fallback' },
      openForEditing: false,
    })
  })

  it('asks for a "when" on a second way out of a step that listens', () => {
    const plan = planConnection({ nodes, edges }, { source: 'talk', target: 'b', sourceHandle: 'out' }, 'new')
    expect(plan).toMatchObject({ action: 'add', openForEditing: true, edge: { kind: 'condition' } })
  })

  it('makes a first connection a plain next step', () => {
    const plan = planConnection({ nodes, edges: [] }, { source: 'talk', target: 'b', sourceHandle: 'out' }, 'new')
    expect(plan).toMatchObject({ action: 'add', openForEditing: false, edge: { kind: 'always' } })
  })
})
