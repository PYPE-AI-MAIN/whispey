// "Ask Pype for help" requests from Agent Studio and the MCP: what a request
// may contain, and how it is written up as a Jira issue. No I/O here — the
// server side (src/server/helpRequests.ts) sends it.

export const HELP_CATEGORIES = [
  { value: 'stuck_building', label: "I'm stuck building my agent" },
  { value: 'agent_not_working', label: "My agent isn't working as expected" },
  { value: 'change_request', label: 'I need a change Pype has to make' },
  { value: 'other', label: 'Something else' },
] as const

export type HelpCategory = (typeof HELP_CATEGORIES)[number]['value']

export const MAX_HELP_MESSAGE = 4000
const MIN_HELP_MESSAGE = 10

export interface HelpRequestInput {
  category: HelpCategory
  message: string
}

export type HelpRequestCheck = { ok: true; value: HelpRequestInput } | { ok: false; error: string }

export function validateHelpRequest(input: unknown): HelpRequestCheck {
  const body = (input ?? {}) as Record<string, unknown>
  const category = typeof body.category === 'string' ? body.category : 'other'
  if (!HELP_CATEGORIES.some((c) => c.value === category)) {
    return { ok: false, error: `category must be one of: ${HELP_CATEGORIES.map((c) => c.value).join(', ')}` }
  }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length < MIN_HELP_MESSAGE) {
    return { ok: false, error: `Please describe what you need (at least ${MIN_HELP_MESSAGE} characters)` }
  }
  if (message.length > MAX_HELP_MESSAGE) {
    return { ok: false, error: `Please keep it under ${MAX_HELP_MESSAGE} characters` }
  }
  return { ok: true, value: { category: category as HelpCategory, message } }
}

export function categoryLabel(category: string): string {
  return HELP_CATEGORIES.find((c) => c.value === category)?.label ?? category
}

export interface HelpRequestFacts {
  category: string
  message: string
  source: 'studio' | 'mcp'
  projectId: string
  projectName?: string | null
  agentId?: string | null
  agentName?: string | null
  requester?: string | null
  studioUrl?: string | null
  lastCallId?: string | null
}

const SUMMARY_LIMIT = 120

/** One-line Jira summary: who/what, then the start of the message. */
export function helpRequestSummary(f: HelpRequestFacts): string {
  const who = f.projectName || f.projectId
  const firstLine = f.message.split('\n')[0].trim()
  const text = `[Agent Studio] ${who}: ${firstLine}`
  return text.length > SUMMARY_LIMIT ? `${text.slice(0, SUMMARY_LIMIT - 1)}…` : text
}

type AdfNode = Record<string, unknown>
const paragraph = (text: string): AdfNode => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })

/** Jira Cloud REST v3 issue body (description in Atlassian Document Format). */
export function buildJiraIssue(f: HelpRequestFacts, projectKey: string, issueType: string) {
  const details = [
    ['Category', categoryLabel(f.category)],
    ['Raised from', f.source === 'mcp' ? 'Claude (MCP)' : 'Agent Studio page'],
    ['Requested by', f.requester || 'unknown'],
    ['Project', f.projectName ? `${f.projectName} (${f.projectId})` : f.projectId],
    ['Agent', f.agentId ? `${f.agentName || 'unnamed'} (${f.agentId})` : 'not specified'],
    ['Last test call', f.lastCallId || 'none'],
    ['Studio', f.studioUrl || 'n/a'],
  ]
  return {
    fields: {
      project: { key: projectKey },
      issuetype: { name: issueType },
      summary: helpRequestSummary(f),
      labels: ['agent-studio', 'client-request', f.source === 'mcp' ? 'via-mcp' : 'via-studio'],
      description: {
        type: 'doc',
        version: 1,
        content: [
          ...f.message.split('\n').map((line) => paragraph(line)),
          { type: 'rule' },
          {
            type: 'bulletList',
            content: details.map(([k, v]) => ({ type: 'listItem', content: [paragraph(`${k}: ${v}`)] })),
          },
        ],
      },
    },
  }
}
