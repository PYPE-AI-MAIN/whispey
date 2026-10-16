import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkflowStore } from '@/stores/workflowStore'
import { explainIssue } from '@/lib/workflow/plainIssues'
import { createDefaultNode, safeParseWorkflow } from '@/lib/workflow/schema'
import { extractGlobalRules } from '@/lib/workflow/globalRules'

const store = () => useWorkflowStore.getState()
const issues = (pred?: (m: string) => boolean) => store().lintIssues.filter((i) => !pred || pred(i.message))

function start(nodes: any[], edges: any[] = [], extra: any = {}) {
  const wf = safeParseWorkflow({ start: nodes[0].id, transports: { web: { enabled: true } }, nodes, edges, ...extra }).data!
  store().setWorkflow(wf, { dirty: false })
}

beforeEach(() => store().setWorkflow(safeParseWorkflow({ start: 'x', nodes: [{ id: 'x', type: 'ending' }], transports: { web: { enabled: true } } }).data!, { dirty: false }))

describe('adding a step with the + (what AddNextStep does)', () => {
  it('a step added after another is reachable and has no unreachable warning', () => {
    start([{ id: 'a', type: 'conversation', prompt: 'hi' }])
    store().addNode(createDefaultNode('ending', 'b', { x: 320, y: 0 }))
    expect(issues((m) => m.includes("'b'")).some((i) => i.message.includes('unreachable'))).toBe(true) // before connecting
    store().addEdge({ id: 'e', source: 'a', target: 'b', kind: 'always' })
    expect(issues().some((i) => i.message.includes('unreachable'))).toBe(false)
  })

  it('a second "when" path needs its description, and the message says so in plain words', () => {
    start([{ id: 'a', type: 'conversation', prompt: 'hi' }, { id: 'b', type: 'ending' }, { id: 'c', type: 'ending' }],
      [{ id: 'e1', source: 'a', target: 'b', kind: 'always' }])
    store().addEdge({ id: 'e2', source: 'a', target: 'c', kind: 'condition' })
    const i = issues().find((x) => x.edgeId === 'e2')!
    expect(i.severity).toBe('error')
    expect(explainIssue(i, store().workflow)).toContain('Describe when')
    store().updateEdge('e2', { condition: 'they want to cancel' })
    expect(issues().some((x) => x.edgeId === 'e2')).toBe(false)
  })
})

describe('Branch paths (what BranchEditor does)', () => {
  const branchFlow = () =>
    start(
      [{ id: 'a', type: 'conversation', prompt: 'hi' }, { id: 'br', type: 'logic_split' }, { id: 'x1', type: 'ending' }, { id: 'x2', type: 'ending' }],
      [{ id: 'e0', source: 'a', target: 'br', kind: 'always' }],
      { variables: [{ key: 'age', type: 'number' }] }
    )

  it('a rule path without a rule is an error; with a rule and an Otherwise path it is clean', () => {
    branchFlow()
    store().addEdge({ id: 'p1', source: 'br', target: 'x1', kind: 'logic' })
    expect(issues().some((i) => i.edgeId === 'p1' && i.severity === 'error')).toBe(true)
    store().updateEdge('p1', { expression: 'age > 18' })
    store().addEdge({ id: 'p2', source: 'br', target: 'x2', kind: 'fallback' })
    expect(issues().filter((i) => i.severity === 'error')).toEqual([])
  })
})

describe('problems for a step with nothing around it (what StepGuide offers to fix)', () => {
  it('a loose step is unreachable and a dead end, then connecting both ways clears it', () => {
    start([{ id: 'a', type: 'conversation', prompt: 'hi' }, { id: 'loose', type: 'conversation', prompt: 'x' }, { id: 'end', type: 'ending' }],
      [{ id: 'e1', source: 'a', target: 'end', kind: 'always' }])
    const msgs = issues().map((i) => explainIssue(i, store().workflow))
    expect(msgs.some((m) => m.includes('Nothing leads to this step'))).toBe(true)
    expect(msgs.some((m) => m.includes('no way forward'))).toBe(true)
    store().addEdge({ id: 'in', source: 'a', target: 'loose', kind: 'condition', condition: 'they ask' })
    store().addEdge({ id: 'out', source: 'loose', target: 'end', kind: 'always' })
    expect(issues().filter((i) => i.nodeId === 'loose')).toEqual([])
  })
})

describe('global rules in the store', () => {
  it('deleting a step removes global rules pointing at it and drops it from sources', () => {
    start([{ id: 'a', type: 'conversation', prompt: 'hi' }, { id: 'h', type: 'ending' }, { id: 'z', type: 'ending' }],
      [{ id: 'e', source: 'a', target: 'z', kind: 'always' }],
      { globalRules: [{ id: 'g1', target: 'h', condition: 'human', sources: ['a'] }] })
    expect(issues().some((i) => i.message.includes('does not exist'))).toBe(false)
    store().removeNode('h')
    expect(store().workflow!.globalRules).toEqual([])
  })

  it('a global rule counts as a way in, so its target is not flagged unreachable', () => {
    start([{ id: 'a', type: 'conversation', prompt: 'hi' }, { id: 'h', type: 'ending' }, { id: 'z', type: 'ending' }],
      [{ id: 'e', source: 'a', target: 'z', kind: 'always' }],
      { globalRules: [{ id: 'g1', target: 'h', condition: 'human', sources: [] }] })
    expect(issues().some((i) => i.message.includes("'h'") && i.message.includes('unreachable'))).toBe(false)
  })

  it('merging repeated connections never raises errors and keeps every step reachable', () => {
    const nodes: any[] = [{ id: 's1', type: 'conversation', prompt: 'a' }, { id: 's2', type: 'conversation', prompt: 'b' },
      { id: 's3', type: 'conversation', prompt: 'c' }, { id: 'h', type: 'ending' }, { id: 'z', type: 'ending' }]
    const edges: any[] = [
      { id: 'n1', source: 's1', target: 's2', kind: 'always' }, { id: 'n2', source: 's2', target: 's3', kind: 'always' }, { id: 'n3', source: 's3', target: 'z', kind: 'always' },
      ...['s1', 's2', 's3'].map((s, i) => ({ id: `h${i}`, source: s, target: 'h', kind: 'condition', condition: 'they ask for a human' })),
    ]
    start(nodes, edges)
    const before = issues().filter((i) => i.severity === 'error').length
    const merged = extractGlobalRules(store().workflow!)
    store().patchWorkflow({ edges: merged.edges, globalRules: merged.globalRules })
    expect(store().workflow!.edges).toHaveLength(3)
    expect(store().workflow!.globalRules).toHaveLength(1)
    expect(issues().filter((i) => i.severity === 'error').length).toBeLessThanOrEqual(before)
    expect(issues().some((i) => i.message.includes('unreachable'))).toBe(false)
  })
})

describe('details that may not apply', () => {
  it('a collect-details field is required unless marked otherwise', () => {
    start([{ id: 'q', type: 'extract_variable', prompt: 'ask', extractions: [{ variable: 'status' }, { variable: 'weeks', required: false }] }, { id: 'e', type: 'ending' }],
      [{ id: 'x', source: 'q', target: 'e', kind: 'always' }])
    const node = store().workflow!.nodes[0] as any
    expect(node.extractions.map((f: any) => f.required)).toEqual([true, false])
  })
})

describe('placeholders', () => {
  it('a TODO left in a step is flagged, in plain words', () => {
    start([{ id: 'a', type: 'conversation', prompt: 'hi' }, { id: 'api', type: 'function', url: 'TODO: patient_register endpoint', method: 'POST' }, { id: 'e', type: 'ending' }],
      [{ id: 'x', source: 'a', target: 'api', kind: 'always' }, { id: 'y', source: 'api', target: 'e', kind: 'always' }])
    const i = issues().find((x) => x.nodeId === 'api' && x.message.includes('TODO'))!
    expect(i.severity).toBe('warning')
    expect(explainIssue(i, store().workflow)).toContain('real value')
  })
  it('a normal URL is not flagged', () => {
    start([{ id: 'a', type: 'conversation', prompt: 'hi' }, { id: 'api', type: 'function', url: 'https://api.example.com/x', method: 'GET' }, { id: 'e', type: 'ending' }],
      [{ id: 'x', source: 'a', target: 'api', kind: 'always' }, { id: 'y', source: 'api', target: 'e', kind: 'always' }])
    expect(issues().some((x) => x.message.includes('TODO'))).toBe(false)
  })
})
