/**
 * Pi may only link to a path inside this app, and only one a tool result gave
 * it. Anything else — an absolute URL it composed (it used to resolve agent
 * links against the chat page it was on and emit
 * https://.../<project>/pi/<session>/agents/<id>), or a URL that rode in on
 * data it read back, such as an agent prompt or a call transcript — renders as
 * plain text instead of a clickable link, so neither a hallucination nor an
 * injected one can be clicked.
 */
export function internalPiHref(href: string | undefined): string | null {
  if (!href) return null
  // `//host` is protocol-relative and `/\host` is treated as `//host` by
  // browsers — both leave the app despite the leading slash.
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\')) return null
  if (/[\s\p{Cc}]/u.test(href)) return null
  return href
}

const nameKey = (s: string) => s.replaceAll(/\s+/g, ' ').trim().toLowerCase()

type ToolCallLike = { name?: string; result?: any }

/**
 * Agent name -> real in-app path, built only from tool results already in the chat (list_agents,
 * get_agent_details, open_page). The model sometimes writes a link with a wrong URL, or none; since it
 * still writes the agent's NAME as the link text, the name is what lets us point the link at the right place.
 */
export function buildAgentLinkMap(messages: { toolCalls?: ToolCallLike[] }[], projectId: string): Map<string, string> {
  const map = new Map<string, string>()
  const add = (name: unknown, id: unknown, href: unknown) => {
    if (typeof name !== 'string' || !name.trim()) return
    const path = internalPiHref(typeof href === 'string' ? href : undefined) ?? (typeof id === 'string' && /^[\w-]+$/.test(id) ? `/${projectId}/agents/${id}` : null)
    if (path) map.set(nameKey(name), path)
  }
  for (const m of messages) {
    for (const tc of m.toolCalls ?? []) {
      const r = tc.result
      if (!r || typeof r !== 'object') continue
      if (tc.name === 'list_agents' && Array.isArray(r.agents)) for (const a of r.agents) add(a?.display_name, a?.id, a?.href)
      else if (tc.name === 'get_agent_details') add(r.display_name, r.agent_id, r.href)
    }
  }
  return map
}

/** The path a link should open: the model's own href if it is an in-app path, else the agent its text names, else none (plain text). */
export function resolvePiHref(href: string | undefined, linkText: string, agentLinks: Map<string, string>): string | null {
  return internalPiHref(href) ?? agentLinks.get(nameKey(linkText)) ?? null
}
