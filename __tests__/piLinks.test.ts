import { describe, it, expect } from 'vitest'
import { internalPiHref } from '@/lib/piLinks'

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
