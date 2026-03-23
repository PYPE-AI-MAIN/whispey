/**
 * Visibility = what sections/features a user can see. Stored in DB as
 * pype_voice_email_project_mapping.permissions.visibility (single column).
 *
 * Flow:
 * 1. API /api/projects/[id]/me reads role + permissions.visibility from DB.
 * 2. getEffectiveVisibility(role, storedVisibility) merges with role defaults.
 * 3. Frontend useMemberVisibility(projectId) gets { role, visibility } and gates UI.
 * 4. Components use canShowOrgSection(visibility, 'campaign') etc. so only allowed data is shown.
 *
 * To change what users see: edit defaults here or update permissions.visibility in Supabase;
 * frontend reflects on next load or refocus.
 */

export interface OrgVisibility {
  agentList: boolean
  /** Which agent IDs this member can see. null = all agents; [] = none; string[] = only these */
  visibleAgentIds: string[] | null
  phoneSetting: boolean
  campaign: boolean
  projectApi: boolean
  settings: boolean
  /** Field Extractor (on agent pages) */
  fieldExtractor: boolean
  /** Metrics (on agent pages) */
  metrics: boolean
  /** Re-analyze Logs (in Call Logs) */
  reanalyze: boolean
}

export interface AgentOverviewVisibility {
  totalCalls: boolean
  totalMinutes: boolean
  billing: boolean
  totalCost: boolean
  responseTime: boolean
  success: boolean
  retry: boolean
  charts: boolean
}

export interface AgentVisibility {
  overview: AgentOverviewVisibility
  /** Agent Config page (/agents/.../config); owner/admin always see it; viewers need this true in DB */
  agentConfig: boolean
  knowledgeBase: boolean
  /** Phone Calls / phone-call-config under agent (call configuration) */
  phoneCalls: boolean
}

export interface MemberVisibility {
  org: OrgVisibility
  agent: AgentVisibility
}

export const DEFAULT_ORG_VISIBILITY: OrgVisibility = {
  agentList: true,
  visibleAgentIds: null,
  phoneSetting: true,
  campaign: true,
  projectApi: true,
  settings: true,
  fieldExtractor: true,
  metrics: true,
  reanalyze: true,
}

export const DEFAULT_AGENT_OVERVIEW_VISIBILITY: AgentOverviewVisibility = {
  totalCalls: true,
  totalMinutes: true,
  billing: true,
  totalCost: true,
  responseTime: true,
  success: true,
  retry: true,
  charts: true,
}

/** Viewer overview defaults: cost card off unless explicitly granted in DB (merge in getEffectiveVisibility). */
export const VIEWER_AGENT_OVERVIEW_VISIBILITY: AgentOverviewVisibility = {
  ...DEFAULT_AGENT_OVERVIEW_VISIBILITY,
  totalCost: false,
}

export const DEFAULT_AGENT_VISIBILITY: AgentVisibility = {
  overview: DEFAULT_AGENT_OVERVIEW_VISIBILITY,
  agentConfig: true,
  knowledgeBase: true,
  phoneCalls: true,
}

export const DEFAULT_MEMBER_VISIBILITY: MemberVisibility = {
  org: DEFAULT_ORG_VISIBILITY,
  agent: DEFAULT_AGENT_VISIBILITY,
}

// Restricted visibility for viewers - they cannot see certain sections
export const VIEWER_RESTRICTED_VISIBILITY: MemberVisibility = {
  org: {
    ...DEFAULT_ORG_VISIBILITY,
    settings: false,        // Cannot see Settings
    campaign: false,        // Cannot see Campaign
    phoneSetting: false,    // Cannot see Phone Setting
    fieldExtractor: false,  // Cannot see Field Extractor in Overview/Call logs
    metrics: false,         // Cannot see Metrics in Overview/Call logs
    reanalyze: false,       // Cannot see Re-analyze Logs in Call Logs
  },
  agent: {
    overview: VIEWER_AGENT_OVERVIEW_VISIBILITY,
    agentConfig: false,
    knowledgeBase: false, // Cannot see Knowledge Base
    phoneCalls: false, // Cannot see Phone Calls (call configuration)
  },
}

export function mergeWithDefaults(partial: Partial<MemberVisibility> | null | undefined): MemberVisibility {
  if (!partial) return DEFAULT_MEMBER_VISIBILITY
  const org = { ...DEFAULT_ORG_VISIBILITY, ...partial.org }
  if (Array.isArray(partial.org?.visibleAgentIds)) {
    org.visibleAgentIds = partial.org.visibleAgentIds
  } else if (partial.org?.visibleAgentIds === null) {
    org.visibleAgentIds = null
  }
  return {
    org,
    agent: {
      overview: { ...DEFAULT_AGENT_OVERVIEW_VISIBILITY, ...partial.agent?.overview },
      agentConfig: partial.agent?.agentConfig ?? true,
      knowledgeBase: partial.agent?.knowledgeBase ?? true,
      phoneCalls: partial.agent?.phoneCalls ?? true,
    },
  }
}

/**
 * Single source of truth: compute effective visibility for a member from role + stored DB overrides.
 * - Viewer: base = VIEWER_RESTRICTED_VISIBILITY, then merge stored overrides (so DB can grant e.g. campaign).
 * - Owner/Admin: base = DEFAULT_MEMBER_VISIBILITY, then merge stored overrides.
 * Change defaults in VIEWER_RESTRICTED_VISIBILITY / DEFAULT_MEMBER_VISIBILITY or store in DB to change what users see.
 */
export function getEffectiveVisibility(
  role: string,
  storedVisibility: Partial<MemberVisibility> | null | undefined
): MemberVisibility {
  const isViewer = ['user', 'member', 'viewer'].includes(role)
  const base = isViewer ? VIEWER_RESTRICTED_VISIBILITY : DEFAULT_MEMBER_VISIBILITY
  if (!storedVisibility || typeof storedVisibility !== 'object') return base
  const org = { ...base.org, ...storedVisibility.org }
  if (Array.isArray(storedVisibility.org?.visibleAgentIds)) {
    org.visibleAgentIds = storedVisibility.org.visibleAgentIds
  } else if (storedVisibility.org?.visibleAgentIds === null) {
    org.visibleAgentIds = null
  }
  return {
    org,
    agent: {
      overview: { ...base.agent.overview, ...storedVisibility.agent?.overview },
      agentConfig: storedVisibility.agent?.agentConfig ?? base.agent.agentConfig,
      knowledgeBase: storedVisibility.agent?.knowledgeBase ?? base.agent.knowledgeBase,
      phoneCalls: storedVisibility.agent?.phoneCalls ?? base.agent.phoneCalls,
    },
  }
}

/** Keys for org-level sidebar sections and features driven by visibility (single place to add new sections). */
export const ORG_VISIBILITY_KEYS = {
  campaign: 'campaign',
  phoneSetting: 'phoneSetting',
  settings: 'settings',
  fieldExtractor: 'fieldExtractor',
  metrics: 'metrics',
  reanalyze: 'reanalyze',
} as const

/**
 * Whether an org-level section should be shown. Use this in the sidebar so all sections follow one rule.
 * Change visibility in DB or via getEffectiveVisibility defaults to affect the UI.
 */
export function canShowOrgSection(
  visibility: Partial<MemberVisibility> | null | undefined,
  key: keyof typeof ORG_VISIBILITY_KEYS
): boolean {
  if (!visibility?.org || typeof visibility.org !== 'object') return false
  const value = (visibility.org as unknown as Record<string, boolean | undefined>)[key]
  return value === true
}

/**
 * Whether an agent-level section should be shown (e.g. Knowledge Base). Single rule for all agent nav items.
 */
export function canShowAgentSection(
  visibility: Partial<MemberVisibility> | null | undefined,
  key: 'agentConfig' | 'knowledgeBase' | 'phoneCalls'
): boolean {
  if (!visibility?.agent || typeof visibility.agent !== 'object') return false
  if (key === 'agentConfig') return visibility.agent.agentConfig === true
  if (key === 'knowledgeBase') return visibility.agent.knowledgeBase === true
  if (key === 'phoneCalls') return visibility.agent.phoneCalls === true
  return false
}
