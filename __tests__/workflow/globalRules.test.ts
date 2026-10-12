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
