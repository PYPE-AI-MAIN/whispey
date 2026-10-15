import { describe, expect, it } from 'vitest'
import { ghostEdges, sharedEndingIds, stageBoxes, tracePathIds, traceSteps, visitNumbers } from '@/lib/workflow/canvasModel'
import type { Edge, GlobalRule, Workflow } from '@/lib/workflow/schema'

const node = (id: string, type: string, stage: string | null, x: number, y: number, name?: string) =>
  ({ id, type, stage, name, position: { x, y } }) as unknown as Workflow['nodes'][number]
const edge = (id: string, source: string, target: string) => ({ id, source, target, kind: 'always' }) as Edge
const rule = (id: string, target: string, sources: string[] = []) => ({ id, target, condition: 'they ask for a person', sources }) as GlobalRule

const nodes = [
  node('greet', 'conversation', 'Greeting', 0, 0, 'Greet'),
  node('ask', 'extract_variable', 'Greeting', 300, 0, 'Ask name'),
  node('book', 'conversation', 'Booking', 600, 0, 'Book'),
  node('confirm', 'conversation', 'Booking', 900, 0, 'Confirm'),
  node('human', 'ending', null, 0, 300, 'Hand off'),
  node('end', 'ending', null, 1200, 0, 'End'),
]

describe('stageBoxes', () => {
  it('draws one box per stage that has at least two steps', () => {
    const boxes = stageBoxes(nodes)
    expect(boxes.map((b) => b.stage)).toEqual(['Greeting', 'Booking'])
    expect(boxes[0].x).toBeLessThan(0)
    expect(boxes[0].width).toBeGreaterThan(520)
  })

  it('leaves out a stage that would cover another one', () => {
    const scattered = [
      ...nodes,
      node('far', 'conversation', 'Greeting', 3000, 0, 'Far'),
    ]
    // Greeting now spans the whole canvas and would sit on top of Booking: Booking (compact) is kept, Greeting is not.
    expect(stageBoxes(scattered).map((b) => b.stage)).toEqual(['Booking'])
  })

  it('draws nothing for a flow with a single stage or none', () => {
    expect(stageBoxes(nodes.map((n) => ({ ...n, stage: n.stage ? 'One' : null })))).toEqual([])
    expect(stageBoxes(nodes.map((n) => ({ ...n, stage: null })))).toEqual([])
  })
})

describe('ghostEdges', () => {
  const wf = { nodes, edges: [], globalRules: [rule('g1', 'human')] }

  it('shows where a rule can send the call from the selected step', () => {
    const ghosts = ghostEdges(wf, 'book')
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0]).toMatchObject({ source: 'book', target: 'human', label: 'they ask for a person' })
  })

  it('shows every step that can reach a rule target when that target is selected', () => {
    const ghosts = ghostEdges(wf, 'human')
    expect(ghosts.map((g) => g.source).sort()).toEqual(['ask', 'book', 'confirm', 'greet'])
    expect(ghosts.every((g) => g.label === undefined)).toBe(true)
  })

  it('respects a rule that lists only some steps, and shows nothing with no selection', () => {
    const some = { ...wf, globalRules: [rule('g1', 'human', ['greet'])] }
    expect(ghostEdges(some, 'book')).toEqual([])
    expect(ghostEdges(some, 'human').map((g) => g.source)).toEqual(['greet'])
    expect(ghostEdges(wf, null)).toEqual([])
  })
})

describe('call path', () => {
  it('maps saved step names to ids and counts the ones that no longer exist', () => {
    const { ids, missing } = tracePathIds({ nodes }, ['Greet', 'Ask name', 'Removed step', 'Book'])
    expect(ids).toEqual(['greet', 'ask', 'book'])
    expect(missing).toBe(1)
  })

  it('finds the connection for each hop and adds one when none is drawn', () => {
    const steps = traceSteps([edge('e1', 'greet', 'ask')], ['greet', 'ask', 'human'])
    expect(steps).toEqual([
      { id: 'e1', source: 'greet', target: 'ask', synthetic: false },
      { id: 'trace:2', source: 'ask', target: 'human', synthetic: true },
    ])
  })

  it('numbers every visit, including a step visited twice', () => {
    const visits = visitNumbers(['greet', 'ask', 'greet'])
    expect(visits.get('greet')).toEqual([1, 3])
    expect(visits.get('ask')).toEqual([2])
  })
})

describe('sharedEndingIds', () => {
  it('flags endings with three or more incoming connections', () => {
    const edges = [edge('a', 'greet', 'end'), edge('b', 'ask', 'end'), edge('c', 'book', 'end'), edge('d', 'greet', 'human')]
    expect([...sharedEndingIds({ nodes, edges })]).toEqual(['end'])
  })
})
