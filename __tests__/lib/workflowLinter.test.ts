import { describe, it, expect } from 'vitest'
import { lintWorkflow, hasErrors } from '@/lib/workflow/linter'
import {
  parseSimpleExpression,
  buildSimpleExpression,
  getKnownVariables,
} from '@/lib/workflow/logicExpression'
import type { Workflow } from '@/lib/workflow/schema'

function wf(partial: Partial<Workflow>): Workflow {
  return {
    start: 's',
    variables: [],
    transports: { web: { enabled: true } },
    nodes: [{ id: 's', type: 'conversation', prompt: 'hi' }],
    edges: [],
    ...partial,
  } as unknown as Workflow
}

describe('lintWorkflow', () => {
  it('accepts a minimal valid workflow', () => {
    expect(hasErrors(lintWorkflow(wf({})))).toBe(false)
  })

  it('errors on unknown start and no transport', () => {
    const issues = lintWorkflow(wf({ start: 'nope', transports: {} as never }))
    expect(hasErrors(issues)).toBe(true)
    expect(issues.some((i) => i.message.includes("start 'nope'"))).toBe(true)
    expect(issues.some((i) => i.message.includes('No transport'))).toBe(true)
  })

  it('flags duplicate node ids', () => {
    const issues = lintWorkflow(wf({
      nodes: [
        { id: 'a', type: 'conversation', prompt: 'x' },
        { id: 'a', type: 'ending' },
      ] as never,
    }))
    expect(issues.some((i) => i.message.includes('Duplicate node id'))).toBe(true)
  })

  it('warns (not errors) on incomplete nodes', () => {
    const issues = lintWorkflow(wf({
      nodes: [{ id: 's', type: 'conversation' }] as never,
      edges: [{ id: 'e', source: 's', target: 's', kind: 'fallback' }] as never,
    }))
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('needs a prompt'))).toBe(true)
    expect(hasErrors(issues)).toBe(false)
  })

  it('stall guard: warns when an LLM node has only condition exits, clears with a catch-all', () => {
    const only = lintWorkflow(wf({
      nodes: [{ id: 's', type: 'conversation', prompt: 'hi' }, { id: 'e', type: 'ending' }] as never,
      edges: [{ id: 'c', source: 's', target: 'e', kind: 'condition', condition: 'bye' }] as never,
    }))
    expect(only.some((i) => i.message.includes('can stall'))).toBe(true)

    const withCatchAll = lintWorkflow(wf({
      nodes: [{ id: 's', type: 'conversation', prompt: 'hi' }, { id: 'e', type: 'ending' }] as never,
      edges: [
        { id: 'c', source: 's', target: 'e', kind: 'condition', condition: 'bye' },
        { id: 'f', source: 's', target: 'e', kind: 'fallback' },
      ] as never,
    }))
    expect(withCatchAll.some((i) => i.message.includes('can stall'))).toBe(false)
  })

  it('warns on save_as collisions', () => {
    const issues = lintWorkflow(wf({
      nodes: [
        { id: 's', type: 'conversation', prompt: 'hi' },
        { id: 'f1', type: 'function', url: 'http://x', saveAs: 'r' },
        { id: 'f2', type: 'function', url: 'http://y', saveAs: 'r' },
      ] as never,
      edges: [
        { id: 'e0', source: 's', target: 'f1', kind: 'fallback' },
        { id: 'e1', source: 'f1', target: 'f2', kind: 'always' },
        { id: 'e2', source: 'f2', target: 's', kind: 'always' },
      ] as never,
    }))
    expect(issues.some((i) => i.message.includes("written by 2 nodes"))).toBe(true)
  })

  it('errors on dangling edges and condition edges on non-LLM sources', () => {
    const issues = lintWorkflow(wf({
      nodes: [{ id: 's', type: 'conversation', prompt: 'hi' }, { id: 'l', type: 'logic_split' }] as never,
      edges: [
        { id: 'bad', source: 's', target: 'ghost', kind: 'always' },
        { id: 'c', source: 'l', target: 's', kind: 'condition', condition: 'x' },
      ] as never,
    }))
    expect(issues.some((i) => i.message.includes("'ghost' is not a node"))).toBe(true)
    expect(issues.some((i) => i.message.includes('only meaningful on'))).toBe(true)
  })
})

describe('logicExpression', () => {
  it('parses simple comparisons', () => {
    expect(parseSimpleExpression('age >= 18')).toEqual({ variable: 'age', operator: '>=', value: '18' })
    expect(parseSimpleExpression("name == 'Al'")).toEqual({ variable: 'name', operator: '==', value: 'Al' })
    expect(parseSimpleExpression('ok != true')).toEqual({ variable: 'ok', operator: '!=', value: 'true' })
  })

  it('returns null for compound / invalid expressions', () => {
    expect(parseSimpleExpression('x > 1 && y == 2')).toBeNull()
    expect(parseSimpleExpression('not an expression')).toBeNull()
  })

  it('builds expressions, quoting + escaping string values', () => {
    expect(buildSimpleExpression({ variable: 'n', operator: '>', value: '5' }, 'number')).toBe('n > 5')
    expect(buildSimpleExpression({ variable: 's', operator: '==', value: "O'Brien" }, 'string')).toBe("s == 'O\\'Brien'")
  })

  it('collects known variables from globals, extractions and saveAs', () => {
    const names = getKnownVariables(wf({
      variables: [{ key: 'g', type: 'string' }] as never,
      nodes: [
        { id: 'x', type: 'extract_variable', extractions: [{ variable: 'age', type: 'number' }] },
        { id: 'f', type: 'function', url: 'http://x', saveAs: 'res' },
      ] as never,
    })).map((v) => v.name)
    expect(names).toEqual(expect.arrayContaining(['g', 'age', 'res']))
  })
})
