import { describe, it, expect } from 'vitest'
import { internalPiHref, buildAgentLinkMap, resolvePiHref } from '@/lib/piLinks'

describe('internalPiHref', () => {
  it('keeps an in-app path', () => {
    expect(internalPiHref('/proj-1/agents/agent-1')).toBe('/proj-1/agents/agent-1')
    expect(internalPiHref('/proj-1/agents/agent-1?tab=logs')).toBe('/proj-1/agents/agent-1?tab=logs')
  })

  it.each([
    // the reported bug: Pi composed the agent link off the chat page it was on
    'https://www.whispey.xyz/proj-1/pi/sess-1/agents/agent-1',
    'http://localhost:3000/proj-1/agents/agent-1',
    // a link riding in on data Pi read back (prompt, transcript, field value)
    'https://whispey-security.example.com/reauth',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//evil.example.com/x',
    '/\\evil.example.com/x',
    '/proj-1/agents/\nagent-1',
    undefined,
  ])('drops %s', (href) => {
    expect(internalPiHref(href as string | undefined)).toBeNull()
  })
})

describe('agent links by name', () => {
  const P = 'proj-1'
  const msgs = [
    { toolCalls: [{ name: 'list_agents', result: { agents: [
      { id: 'a1', display_name: 'NH Add Family Member  LQ' },
      { id: 'a2', display_name: 'HRA - GMC Agent', href: '/proj-1/agents/a2' },
      { id: '../x', display_name: 'Bad Id Agent' },
    ] } }] },
    { toolCalls: [{ name: 'get_agent_details', result: { agent_id: 'a3', display_name: 'NHIL Demo Agent' } }] },
    { toolCalls: [{ name: 'query_analytics', result: { agents: [{ id: 'zz', display_name: 'Not A Source' }] } }] },
    { toolCalls: [{ name: 'list_agents' }] },
    {},
  ]
  const map = buildAgentLinkMap(msgs, P)

  it('builds the real path from list_agents and get_agent_details only', () => {
    expect(map.get('nh add family member lq')).toBe('/proj-1/agents/a1')
    expect(map.get('hra - gmc agent')).toBe('/proj-1/agents/a2')
    expect(map.get('nhil demo agent')).toBe('/proj-1/agents/a3')
    expect(map.has('not a source')).toBe(false)
    expect(map.has('bad id agent')).toBe(false)
  })

  it('points a wrong model URL at the agent its text names (the reported case)', () => {
    const wrong = 'https://www.whispey.xyz/proj-1/pi/proj-1/agents/a1'
    expect(resolvePiHref(wrong, 'NH Add Family Member  LQ', map)).toBe('/proj-1/agents/a1')
    expect(resolvePiHref(undefined, '  nh add   family member lq ', map)).toBe('/proj-1/agents/a1')
  })

  it('keeps a good in-app href, and never invents one for unknown text', () => {
    expect(resolvePiHref('/proj-1/agents/a2', 'whatever', map)).toBe('/proj-1/agents/a2')
    expect(resolvePiHref('https://evil.example.com', 'Click here', map)).toBeNull()
    expect(resolvePiHref('https://evil.example.com', 'not-an-agent', new Map())).toBeNull()
  })

  it('does not let a link labelled with an agent name reach an outside site', () => {
    expect(resolvePiHref('javascript:alert(1)', 'HRA - GMC Agent', map)).toBe('/proj-1/agents/a2')
  })
})
