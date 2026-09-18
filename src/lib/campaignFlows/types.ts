import type { RetryConfig } from '@/utils/campaigns/constants'

// A dispatch node is anything that actually contacts a person on some channel.
export type ChannelKind = 'call' | 'whatsapp' | 'video'

// A control node shapes the sequence itself, but never contacts anyone directly.
// 'branch' is its own block — a visible decision point you drop into the
// graph, rather than something hidden inside a dispatch node's settings.
export type ControlKind = 'trigger' | 'wait' | 'branch' | 'success' | 'end'

export type FlowNodeKind = ChannelKind | ControlKind

export const CHANNEL_KINDS: ChannelKind[] = ['call', 'whatsapp', 'video']

export function isChannelKind(kind: FlowNodeKind): kind is ChannelKind {
  return (CHANNEL_KINDS as FlowNodeKind[]).includes(kind)
}

// A branch condition reuses the exact same fields as the real RetryConfig
// (sipCode / metric / fieldExtractor / metadata) — the same signals a client
// already configures for retries — just without the retry-specific timing
// fields, since a branch decides where to go, not whether to try again.
export type BranchConditionType = 'sipCode' | 'metric' | 'fieldExtractor' | 'metadata'
export type BranchOperator = '<' | '>' | '<=' | '>=' | '==' | '!=' | 'missing' | 'equals' | 'not_equals' | 'contains' | 'not_contains'

export type BranchCondition = {
  type: BranchConditionType
  errorCodes?: string[]
  metricName?: string
  threshold?: number
  fieldName?: string
  expectedValue?: unknown
  operator?: BranchOperator
}

export type FlowBranch = {
  id: string
  label: string
  condition: BranchCondition
}

// Dispatch node config: always a single next step (like wait/trigger). All
// branching lives in a separate 'branch' block node instead — see
// BranchNodeConfig.
export type DispatchNodeConfig = {
  channel: ChannelKind
  message: string
  guardEnabled: boolean
  retryRules: RetryConfig[]
}

// A 'branch' block's config: freeform, user-defined branches built from the
// same real signals (sipCode / metric / fieldExtractor / metadata) a client
// already understands from campaign retry rules. The first matching branch
// wins; anything matching none of them falls to the node's fixed "Otherwise"
// path.
export type BranchNodeConfig = {
  branches: FlowBranch[]
}

export type WaitNodeConfig = {
  durationValue: number
  durationUnit: 'minutes' | 'hours' | 'days'
}

export type TriggerNodeConfig = {
  source: string
}

export type FlowNodeConfig = DispatchNodeConfig | BranchNodeConfig | WaitNodeConfig | TriggerNodeConfig | Record<string, never>

export type FlowNodeData = {
  kind: FlowNodeKind
  title: string
  subtitle?: string
  config: FlowNodeConfig
}

// What each node compiles to on the n8n side — shown in the builder so
// "drag a box" always maps to a real, specific backend module.
export const N8N_NODE_MODULE: Record<FlowNodeKind, string> = {
  trigger: 'n8n-nodes-base.webhook',
  call: 'pype.dispatchCall (custom node → pype-voice-agent-be)',
  whatsapp: 'pype.dispatchWhatsapp (custom node → WhatsApp Business API)',
  video: 'pype.dispatchVideo (custom node → video provider)',
  wait: 'n8n-nodes-base.wait',
  branch: 'n8n-nodes-base.switch',
  success: 'n8n-nodes-base.noOp',
  end: 'n8n-nodes-base.noOp',
}

export function defaultConfigFor(kind: FlowNodeKind): FlowNodeConfig {
  if (isChannelKind(kind)) {
    return {
      channel: kind,
      message: '',
      guardEnabled: true,
      retryRules: [],
    } satisfies DispatchNodeConfig
  }
  if (kind === 'wait') {
    return { durationValue: 30, durationUnit: 'minutes' } satisfies WaitNodeConfig
  }
  if (kind === 'branch') {
    return { branches: [] } satisfies BranchNodeConfig
  }
  if (kind === 'trigger') {
    return { source: 'Contact list upload' } satisfies TriggerNodeConfig
  }
  return {}
}

export type CampaignFlowSummary = {
  flowId: string
  name: string
  description: string
  status: 'live' | 'draft'
  n8nWorkflowId?: string // set once the first Save creates the workflow; every later Save updates this same id
  agentId?: string // the agent this flow's dispatch steps run through — its field extractor supplies branch/retry field names
  updatedAt: string
}
