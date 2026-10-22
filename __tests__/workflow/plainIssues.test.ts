import { describe, expect, it } from 'vitest'
import { explainIssue } from '@/lib/workflow/plainIssues'

const wf = { nodes: [{ id: 'node-1', name: 'Greet', type: 'conversation' }] } as any
const say = (message: string) => explainIssue({ severity: 'warning', message }, wf)

describe('explainIssue', () => {
  it('explains an unreachable step in plain words, without ids', () => {
    const t = say("node 'node-1' is unreachable from start")
    expect(t).toContain('Nothing leads to this step')
    expect(t).not.toContain('node-1')
  })
  it('explains a dead end', () => {
    expect(say("node 'node-1' is a dead-end (no outgoing edges)")).toContain('no way forward')
  })
  it('explains missing step content per type', () => {
    expect(say('function node needs a url')).toContain('web address')
    expect(say('call_transfer node needs a destination')).toContain('phone number')
  })
  it('swaps ids for step names in anything unmapped', () => {
    expect(say("'node-1' did something odd")).toBe('"Greet" did something odd')
  })
})
