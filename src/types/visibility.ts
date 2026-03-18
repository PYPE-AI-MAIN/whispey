/**
 * Per-member visibility settings. Owner/Admin see everything; User/Viewer see only what is enabled here.
 * Editable by Owner and Admin in Organization Settings per member.
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
  knowledgeBase: boolean
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

export const DEFAULT_AGENT_VISIBILITY: AgentVisibility = {
  overview: DEFAULT_AGENT_OVERVIEW_VISIBILITY,
  knowledgeBase: true,
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
  },
  agent: {
    overview: DEFAULT_AGENT_OVERVIEW_VISIBILITY,
    knowledgeBase: false,   // Cannot see Knowledge Base in agent list
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
      knowledgeBase: partial.agent?.knowledgeBase ?? true,
    },
  }
}
