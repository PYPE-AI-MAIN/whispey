import { describe, it, expect } from 'vitest'
import { checkBuilderOutput, restoreKeptFields, summarizeWorkflow } from '@/lib/workflow/builderOutput'
import { builderSystemContent, WORKFLOW_BUILDER_SYSTEM_PROMPT } from '@/lib/workflow/builderPrompt'
import { WORKFLOW_TEMPLATES } from '@/lib/workflow/templates'
import { flowUrl } from '@/lib/mcpAgentHelpers'

const template = () => WORKFLOW_TEMPLATES.find((t) => t.id === 'appointment-booking')!.build('demo')
const fenced = (obj: unknown) => `Here you go:\n\`\`\`json\n${JSON.stringify(obj)}\n\`\`\`\nBuilt a booking flow.`

describe('checkBuilderOutput', () => {
  it('reports "none" for a prose answer with no JSON block', () => {
    expect(checkBuilderOutput('There are 4 nodes in this flow.', null)).toEqual({ status: 'none' })
  })

  it('reports a cut-off JSON block as malformed', () => {
    const result = checkBuilderOutput('```json\n{"nodes": [\n```', null)
    expect(result).toEqual({ status: 'error', error: expect.stringContaining('malformed') })
  })

  it('accepts a valid workflow and returns its lint warnings', () => {
    const result = checkBuilderOutput(fenced(template()), null)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.workflow.nodes.length).toBeGreaterThan(1)
      expect(Array.isArray(result.warnings)).toBe(true)
    }
  })

  it('folds repeated conditions into global rules, like the canvas does', () => {
    const result = checkBuilderOutput(fenced(template()), null)
    expect(result.status === 'ok' && Array.isArray(result.workflow.globalRules)).toBe(true)
  })

  it('rejects a workflow with no usable nodes', () => {
    const wf = { ...template(), nodes: [], edges: [] }
    const result = checkBuilderOutput(fenced(wf), null)
    expect(result).toEqual({ status: 'error', error: expect.stringContaining('no usable nodes') })
  })

  it('rejects a start that is not a real node', () => {
    const result = checkBuilderOutput(fenced({ ...template(), start: 'nope' }), null)
    expect(result.status).toBe('error')
  })

  it('rejects JSON that does not match the schema', () => {
    const wf = template() as any
    wf.nodes[0].type = 'not_a_node_type'
    const result = checkBuilderOutput(fenced(wf), null)
    expect(result).toEqual({ status: 'error', error: expect.stringContaining('invalid workflow JSON') })
  })

  it('rejects a graph the canvas lint flags as broken', () => {
    const wf = template() as any
    wf.edges = [...wf.edges, { id: 'dangling', source: wf.start, target: 'missing-node', kind: 'always' }]
    const result = checkBuilderOutput(fenced(wf), null)
    expect(result).toEqual({ status: 'error', error: expect.stringContaining('broken workflow graph') })
  })
})

describe('restoreKeptFields', () => {
  it('returns the reply unchanged when there is no current workflow', () => {
    const next = { agent: { globalPrompt: '__KEEP__' } }
    expect(restoreKeptFields(next, null)).toBe(next)
  })

  it('restores kept global prompt, node prompt and static text', () => {
    const current = {
      agent: { globalPrompt: 'persona' },
      nodes: [{ id: 'a', prompt: 'long prompt', staticText: 'hello' }],
    }
    const next = {
      agent: { globalPrompt: '__KEEP__' },
      nodes: [{ id: 'a', prompt: '__KEEP__', staticText: '__KEEP__' }, { id: 'new', prompt: 'p' }],
    }
    const out = restoreKeptFields(next, current)
    expect(out.agent.globalPrompt).toBe('persona')
    expect(out.nodes[0]).toMatchObject({ prompt: 'long prompt', staticText: 'hello' })
    expect(out.nodes[1]).toEqual({ id: 'new', prompt: 'p' })
  })

  it('swaps in the whole original node for a node-level keep', () => {
    const orig = { id: 'fn', type: 'function', url: 'https://x', headers: { a: 'b' } }
    const out = restoreKeptFields({ nodes: [{ id: 'fn', __keep__: true }] }, { nodes: [orig] })
    expect(out.nodes[0]).toBe(orig)
  })
})

describe('summarizeWorkflow', () => {
  it('describes the shape without any prompt text', () => {
    const wf = template()
    const summary = summarizeWorkflow(wf)
    expect(summary.start).toBe(wf.start)
    expect(summary.node_count).toBe(wf.nodes.filter((n) => n.type !== 'note').length)
    expect(summary.edges).toBe(wf.edges.length)
    const text = JSON.stringify(summary)
    for (const n of wf.nodes as any[]) {
      if (n.prompt) expect(text).not.toContain(n.prompt)
    }
    expect(Object.keys(summary.nodes[0]).sort()).toEqual(['id', 'name', 'type'])
  })

  it('leaves out canvas notes', () => {
    const wf = template()
    const withNote = { ...wf, nodes: [...wf.nodes, { id: 'n1', type: 'note', name: 'Note', position: { x: 0, y: 0 }, text: 'hi' }] } as any
    expect(summarizeWorkflow(withNote).nodes.find((n) => n.id === 'n1')).toBeUndefined()
  })
})

describe('builderSystemContent', () => {
  it('is just the builder instructions when there is no workflow yet', () => {
    expect(builderSystemContent(null)).toBe(WORKFLOW_BUILDER_SYSTEM_PROMPT)
  })

  it('appends the current workflow when editing', () => {
    const content = builderSystemContent({ start: 'greeting' })
    expect(content.startsWith(WORKFLOW_BUILDER_SYSTEM_PROMPT)).toBe(true)
    expect(content).toContain("The user's CURRENT workflow is:")
    expect(content).toContain('"start": "greeting"')
  })
})

describe('flowUrl', () => {
  it('links to the flow canvas, trimming a trailing slash', () => {
    expect(flowUrl('p1', 'a1', 'https://www.whispey.xyz/')).toBe('https://www.whispey.xyz/p1/agents/a1/workflow')
    expect(flowUrl('p1', 'a1')).toBe('http://localhost:3000/p1/agents/a1/workflow')
  })
})
