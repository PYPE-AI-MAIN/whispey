import { describe, expect, it } from 'vitest'
import { expandGlobalRules, extractGlobalRules } from '@/lib/workflow/globalRules'

const node = (id: string, type: string) => ({ id, type }) as any
const edge = (id: string, source: string, target: string, condition?: string) =>
  ({ id, source, target, kind: condition ? 'condition' : 'always', condition }) as any

const flow = {
  nodes: [node('a', 'conversation'), node('b', 'conversation'), node('c', 'conversation'), node('d', 'conversation'), node('human', 'ending')],
  edges: [
    edge('e1', 'a', 'b'),
    edge('h1', 'a', 'human', 'they ask for a human'),
    edge('h2', 'b', 'human', 'They ask for a  human'),
    edge('h3', 'c', 'human', 'they ask for a human'),
  ],
  globalRules: [],
}

describe('global rules', () => {
  it('merges a condition repeated from 3+ steps, listing only the steps that had it', () => {
    const { edges, globalRules } = extractGlobalRules(flow)
    expect(edges.map((e) => e.id)).toEqual(['e1'])
    expect(globalRules).toHaveLength(1)
    expect(globalRules[0].sources).toEqual(['a', 'b', 'c'])
  })

  it('expands back to the same behaviour', () => {
    const { edges, globalRules } = extractGlobalRules(flow)
    const back = expandGlobalRules({ ...flow, edges, globalRules })
    const pairs = (es: any[]) => es.map((e) => `${e.source}>${e.target}`).sort()
    expect(pairs(back.edges)).toEqual(pairs(flow.edges))
  })

  it('applies to every listening step when sources is empty', () => {
    const out = expandGlobalRules({ ...flow, edges: [], globalRules: [{ id: 'g', target: 'human', condition: 'x', sources: [] }] })
    expect(out.edges.map((e) => e.source).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

import { lintWorkflow } from '@/lib/workflow/linter'
import { safeParseWorkflow } from '@/lib/workflow/schema'

describe('start node lint', () => {
  const wf = (startType: string) =>
    safeParseWorkflow({
      start: 'a',
      transports: { web: { enabled: true } },
      nodes: [{ id: 'a', type: startType }, { id: 'e', type: 'ending' }],
      edges: [{ id: 'x', source: 'a', target: 'e', kind: 'always' }],
    }).data!

  it('errors when the call would start at a knowledge step', () => {
    expect(lintWorkflow(wf('knowledge')).some((i) => i.severity === 'error' && i.message.includes('knowledge step'))).toBe(true)
  })
  it('does not error for a conversation start', () => {
    expect(lintWorkflow(wf('conversation')).some((i) => i.message.includes('start'))).toBe(false)
  })
})

describe('start fix suggestion', () => {
  it('offers the leftmost speaking step nothing leads to', () => {
    const w = safeParseWorkflow({
      start: 'kb',
      transports: { web: { enabled: true } },
      nodes: [
        { id: 'kb', type: 'knowledge' },
        { id: 'late', type: 'conversation', position: { x: 400, y: 0 } },
        { id: 'hello', type: 'conversation', position: { x: 0, y: 0 } },
        { id: 'e', type: 'ending' },
      ],
      edges: [
        { id: 'a', source: 'kb', target: 'late', kind: 'always' },
        { id: 'b', source: 'late', target: 'e', kind: 'always' },
        { id: 'c', source: 'hello', target: 'e', kind: 'always' },
      ],
    }).data!
    expect(lintWorkflow(w).find((i) => i.fixStartTo)?.fixStartTo).toBe('hello')
  })
})

import { deployable, stripExpandedEdges, MAX_DEPLOY_BYTES } from '@/lib/workflow/globalRules'

describe('deploy compatibility (older backends ignore globalRules)', () => {
  const base = {
    nodes: [node('a', 'conversation'), node('b', 'conversation'), node('human', 'ending')],
    edges: [edge('e1', 'a', 'b')],
    globalRules: [{ id: 'g1', target: 'human', condition: 'they ask for a human', sources: [] as string[] }],
  }

  it('sends the rules and the plain edges they stand for', () => {
    const out = deployable(base as any)
    expect(out.globalRules).toHaveLength(1)
    expect(out.edges.map((e: any) => e.id).sort()).toEqual(['e1', 'g1@a', 'g1@b'])
  })

  it('loading it back shows the rules once, not the edges they made', () => {
    const back = stripExpandedEdges(deployable(base as any))
    expect(back.edges.map((e: any) => e.id)).toEqual(['e1'])
    expect(back.globalRules).toHaveLength(1)
  })

  it('leaves a flow without rules untouched', () => {
    const plain = { nodes: base.nodes, edges: base.edges, globalRules: [] }
    expect(deployable(plain as any)).toBe(plain)
    expect(stripExpandedEdges(plain as any)).toBe(plain)
  })

  it('sends the rules alone when the copies would make the flow too large to store', () => {
    const out = deployable(base as any, 100)
    expect(out).toBe(base)
    expect(out.globalRules).toHaveLength(1)
    expect(out.edges.map((e: any) => e.id)).toEqual(['e1'])
  })

  it('keeps the copies while the flow is within the limit', () => {
    expect(deployable(base as any, MAX_DEPLOY_BYTES).edges).toHaveLength(3)
  })

  it('the limit leaves room under the 400 KB DynamoDB item the backend stores it in', () => {
    expect(MAX_DEPLOY_BYTES).toBeLessThan(400 * 1024 * 0.8)
  })

  it('merging again widens an existing rule instead of duplicating it', () => {
    const wf = {
      nodes: [node('a', 'conversation'), node('b', 'conversation'), node('c', 'conversation'), node('d', 'conversation'), node('human', 'ending')],
      edges: ['a', 'b', 'c'].map((s, i) => edge(`h${i}`, s, 'human', 'they ask for a human')),
      globalRules: [{ id: 'g1', target: 'human', condition: 'They ask for a human', sources: ['d'] }],
    }
    const out = extractGlobalRules(wf as any)
    expect(out.globalRules).toHaveLength(1)
    expect(out.globalRules[0].sources.sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(out.edges).toHaveLength(0)
  })
})

describe('rule ids', () => {
  it('a second merge never reuses an existing rule id', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => node(id, 'conversation')).concat([node('h1', 'ending'), node('h2', 'ending')])
    const wf = {
      nodes,
      edges: [
        ...['a', 'b', 'c'].map((s, i) => edge(`x${i}`, s, 'h1', 'one')),
        ...['d', 'e', 'f'].map((s, i) => edge(`y${i}`, s, 'h2', 'two')),
      ],
      globalRules: [{ id: 'global-1', target: 'h1', condition: 'something else', sources: [] as string[] }],
    }
    const ids = extractGlobalRules(wf as any).globalRules.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

import { readFileSync } from 'node:fs'

describe('editor sends the compatible form', () => {
  it('the check and the deploy request both use deployable()', () => {
    const page = readFileSync('src/app/[projectid]/agents/[agentid]/workflow/page.tsx', 'utf8')
    const hook = readFileSync('src/hooks/useWorkflowDeploy.ts', 'utf8')
    expect(page.split('workflow: deployable(workflow)').length - 1).toBe(1)
    expect(hook.split('workflow: deployable(workflow)').length - 1).toBe(1)
    expect(page).not.toContain('JSON.stringify({ workflow })')
    expect(hook).not.toContain('JSON.stringify({ workflow })')
  })
})
