import { describe, it, expect } from 'vitest'
import {
  buildJiraIssue,
  categoryLabel,
  helpRequestSummary,
  HELP_CATEGORIES,
  MAX_HELP_MESSAGE,
  validateHelpRequest,
  type HelpRequestFacts,
} from '@/lib/helpRequests'

const facts = (over: Partial<HelpRequestFacts> = {}): HelpRequestFacts => ({
  category: 'stuck_building',
  message: 'The agent keeps hanging up\nafter the greeting.',
  source: 'studio',
  projectId: 'p1',
  projectName: 'Narayana Health',
  agentId: 'a1',
  agentName: 'Booking',
  requester: 'client@example.com',
  studioUrl: 'https://www.whispey.xyz/p1/agents/a1/studio',
  lastCallId: 'call-9',
  ...over,
})

describe('validateHelpRequest', () => {
  it('accepts a known category and trims the message', () => {
    expect(validateHelpRequest({ category: 'agent_not_working', message: '  it does not answer calls  ' })).toEqual({
      ok: true,
      value: { category: 'agent_not_working', message: 'it does not answer calls' },
    })
  })

  it('defaults a missing category to "other"', () => {
    const r = validateHelpRequest({ message: 'please help me with this' })
    expect(r.ok && r.value.category).toBe('other')
  })

  it.each([
    ['unknown category', { category: 'refund', message: 'please help me with this' }],
    ['too short', { category: 'other', message: 'help' }],
    ['too long', { category: 'other', message: 'x'.repeat(MAX_HELP_MESSAGE + 1) }],
    ['missing message', { category: 'other' }],
    ['not an object', null],
  ])('rejects %s', (_label, input) => {
    expect(validateHelpRequest(input).ok).toBe(false)
  })
})

describe('categoryLabel', () => {
  it('maps every category to a readable label, and passes unknown values through', () => {
    for (const c of HELP_CATEGORIES) expect(categoryLabel(c.value)).toBe(c.label)
    expect(categoryLabel('mystery')).toBe('mystery')
  })
})

describe('helpRequestSummary', () => {
  it('uses the project name and the first line of the message', () => {
    expect(helpRequestSummary(facts())).toBe('[Agent Studio] Narayana Health: The agent keeps hanging up')
  })

  it('falls back to the project id and caps the length', () => {
    const s = helpRequestSummary(facts({ projectName: null, message: 'y'.repeat(300) }))
    expect(s.startsWith('[Agent Studio] p1: ')).toBe(true)
    expect(s.length).toBeLessThanOrEqual(120)
    expect(s.endsWith('…')).toBe(true)
  })
})

describe('buildJiraIssue', () => {
  it('targets the configured project and issue type, labelled by source', () => {
    const issue = buildJiraIssue(facts({ source: 'mcp' }), 'KAN', 'Task')
    expect(issue.fields.project).toEqual({ key: 'KAN' })
    expect(issue.fields.issuetype).toEqual({ name: 'Task' })
    expect(issue.fields.labels).toEqual(['agent-studio', 'client-request', 'via-mcp'])
  })

  it('puts the message and the agent details in the description', () => {
    const text = JSON.stringify(buildJiraIssue(facts(), 'KAN', 'Task').fields.description)
    expect(text).toContain('The agent keeps hanging up')
    expect(text).toContain('after the greeting.')
    expect(text).toContain('Booking (a1)')
    expect(text).toContain('client@example.com')
    expect(text).toContain('call-9')
    expect(text).toContain('https://www.whispey.xyz/p1/agents/a1/studio')
  })

  it('describes a request with no agent attached', () => {
    const text = JSON.stringify(buildJiraIssue(facts({ agentId: null, lastCallId: null, requester: null }), 'KAN', 'Task'))
    expect(text).toContain('Agent: not specified')
    expect(text).toContain('Last test call: none')
    expect(text).toContain('Requested by: unknown')
  })
})
