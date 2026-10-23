import { describe, it, expect } from 'vitest'
import { runWorkflowBuilder } from '@/server/workflowBuilder'
import { WORKFLOW_TEMPLATES } from '@/lib/workflow/templates'

const template = () => WORKFLOW_TEMPLATES.find((t) => t.id === 'appointment-booking')!.build('demo')
const fenced = (obj: unknown) => `\`\`\`json\n${JSON.stringify(obj)}\n\`\`\`\nBuilt a booking flow.`

/** A stand-in for the OpenAI client that replays canned replies and records requests. */
function fakeClient(replies: Array<{ content: string; finish_reason?: string }>) {
  const requests: any[] = []
  const client = {
    chat: {
      completions: {
        create: async (req: any) => {
          requests.push(structuredClone(req))
          const next = replies.shift()
          if (!next) throw new Error('no more canned replies')
          return { choices: [{ message: { content: next.content }, finish_reason: next.finish_reason ?? 'stop' }] }
        },
      },
    },
  }
  return { client: client as any, requests }
}

describe('runWorkflowBuilder', () => {
  it('returns the flow and the builder\'s short note', async () => {
    const { client, requests } = fakeClient([{ content: fenced(template()) }])
    const result = await runWorkflowBuilder({ instruction: 'book appointments', client })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.workflow.nodes.length).toBeGreaterThan(1)
      expect(result.reply).toBe('Built a booking flow.')
    }
    expect(requests).toHaveLength(1)
    expect(requests[0].messages[1]).toEqual({ role: 'user', content: 'book appointments' })
  })

  it('stitches a reply that ran out of length across rounds', async () => {
    const full = fenced(template())
    const cut = Math.floor(full.length / 2)
    const { client, requests } = fakeClient([
      { content: full.slice(0, cut), finish_reason: 'length' },
      { content: full.slice(cut) },
    ])
    const result = await runWorkflowBuilder({ instruction: 'x', client })
    expect(result.ok).toBe(true)
    expect(requests[1].messages.at(-1).content).toContain('Continue the previous response')
  })

  it('gives the model one chance to fix a validation error', async () => {
    const broken = template() as any
    broken.edges = [...broken.edges, { id: 'dangling', source: broken.start, target: 'missing', kind: 'always' }]
    const { client, requests } = fakeClient([{ content: fenced(broken) }, { content: fenced(template()) }])
    const result = await runWorkflowBuilder({ instruction: 'x', client })
    expect(result.ok).toBe(true)
    expect(requests).toHaveLength(2)
    expect(requests[1].messages.at(-1).content).toContain('failed validation')
  })

  it('reports the error when the retry is still broken', async () => {
    const broken = template() as any
    broken.edges = [...broken.edges, { id: 'dangling', source: broken.start, target: 'missing', kind: 'always' }]
    const { client } = fakeClient([{ content: fenced(broken) }, { content: fenced(broken) }])
    const result = await runWorkflowBuilder({ instruction: 'x', client })
    expect(result).toEqual({ ok: false, error: expect.stringContaining('broken workflow graph') })
  })

  it('reports a prose answer instead of a flow', async () => {
    const { client } = fakeClient([{ content: 'What kind of business is this for?' }])
    const result = await runWorkflowBuilder({ instruction: 'x', client })
    expect(result).toEqual({ ok: false, error: expect.stringContaining('did not produce a flow') })
  })

  it('gives up when the reply never finishes', async () => {
    const { client } = fakeClient(Array.from({ length: 6 }, () => ({ content: 'x', finish_reason: 'length' })))
    const result = await runWorkflowBuilder({ instruction: 'x', client })
    expect(result).toEqual({ ok: false, error: expect.stringContaining('too long') })
  })

  it('sends the current flow when editing', async () => {
    const current = template()
    const { client, requests } = fakeClient([{ content: fenced(current) }])
    await runWorkflowBuilder({ instruction: 'add a transfer', current, client })
    expect(requests[0].messages[0].content).toContain("The user's CURRENT workflow is:")
  })
})
