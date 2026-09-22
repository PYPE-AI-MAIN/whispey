import type { RetryConfig } from '@/utils/campaigns/constants'

// A dispatch node is anything that actually contacts a person on some channel.
// 'video' isn't its own dispatch path — it's currently just a WhatsApp
// message with a video attachment, so it isn't a separate block here.
export type ChannelKind = 'call' | 'whatsapp'

// A control node shapes the sequence itself, but never contacts anyone directly.
// 'condition' is its own block — a single yes/no question you drop into the
// graph, matching how n8n's own `if` node works: one condition (optionally
// several rules ANDed/ORed together), exactly two outputs. Multi-way logic
// comes from chaining several of these, not from one node trying to hold
// many branches at once — that's the pattern the real production n8n
// workflows in NH N8N Exports already use.
export type ControlKind = 'trigger' | 'wait' | 'condition' | 'success' | 'end'

export type FlowNodeKind = ChannelKind | ControlKind

export const CHANNEL_KINDS: ChannelKind[] = ['call', 'whatsapp']

export function isChannelKind(kind: FlowNodeKind): kind is ChannelKind {
  return (CHANNEL_KINDS as FlowNodeKind[]).includes(kind)
}

// A condition rule reuses the exact same fields as the real RetryConfig
// (sipCode / metric / fieldExtractor / metadata) — the same signals a client
// already configures for retries — just without the retry-specific timing
// fields, since a condition decides where to go, not whether to try again.
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

export type ConditionCombinator = 'and' | 'or'

export type ConditionRule = {
  id: string
  condition: BranchCondition
}

// WhatsApp business-initiated messages are always an approved template send
// (Meta's Graph API rejects free-text outside a 24h customer-service window,
// which an outbound campaign always is) — confirmed against real payloads:
// messaging_product/to/type:"template", template.name + language.code, and
// up to three components — an optional video header, a body with N ordered
// text params (count/order fixed by the template itself), and an optional
// url-button token. This isn't "Text vs Video" as two peer types; it's
// "every send fills in one template's declared slots."
export type WhatsAppBodyParam = {
  id: string
  value: string // a static string, or a placeholder like "{{contact.name}}"
}

export type WhatsAppTemplateConfig = {
  templateName: string
  languageCode: string
  videoUrl?: string
  bodyParams: WhatsAppBodyParam[]
  buttonUrlParam?: string
}

// Dispatch node config: always a single next step (like wait/trigger). All
// decision-making lives in a separate 'condition' block instead. `message`
// is the call's spoken script — WhatsApp nodes use `whatsappTemplate`
// instead, since a WhatsApp send isn't freeform text.
export type DispatchNodeConfig = {
  channel: ChannelKind
  message: string
  guardEnabled: boolean
  retryRules: RetryConfig[]
  whatsappTemplate?: WhatsAppTemplateConfig
}

// A 'condition' block's config: one or more rules, built from the same real
// signals (sipCode / metric / fieldExtractor / metadata) a client already
// understands from campaign retry rules — e.g. an "auto guard" check plus a
// "no 500-failure" check combined with AND is exactly one ConditionRule per
// check, combined by `combinator`. However many rules there are, they always
// collapse to a single yes/no, and the block always has exactly two outputs.
export type ConditionNodeConfig = {
  combinator: ConditionCombinator
  rules: ConditionRule[]
}

export type WaitNodeConfig = {
  durationValue: number
  durationUnit: 'minutes' | 'hours' | 'days'
}

export type TriggerNodeConfig = {
  source: string
}

export type FlowNodeConfig = DispatchNodeConfig | ConditionNodeConfig | WaitNodeConfig | TriggerNodeConfig | Record<string, never>

export type FlowNodeData = {
  kind: FlowNodeKind
  title: string
  subtitle?: string
  config: FlowNodeConfig
}

// What each node compiles to on the n8n side — shown in the builder so
// "drag a box" always maps to a real, specific backend module. Confirmed
// against real production workflows (NH N8N Exports): voice dispatch is
// POST https://api.pypeai.com/dispatch_call, WhatsApp (incl. video messages)
// goes through the WhatsApp Business Graph API, and a decision point is
// exactly n8n's own `if` node.
export const N8N_NODE_MODULE: Record<FlowNodeKind, string> = {
  trigger: 'n8n-nodes-base.webhook',
  call: 'n8n-nodes-base.httpRequest (POST api.pypeai.com/dispatch_call)',
  whatsapp: 'n8n-nodes-base.httpRequest (POST graph.facebook.com WhatsApp Business API)',
  wait: 'n8n-nodes-base.wait',
  condition: 'n8n-nodes-base.if',
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
      whatsappTemplate: kind === 'whatsapp' ? { templateName: '', languageCode: 'en_US', bodyParams: [] } : undefined,
    } satisfies DispatchNodeConfig
  }
  if (kind === 'wait') {
    return { durationValue: 30, durationUnit: 'minutes' } satisfies WaitNodeConfig
  }
  if (kind === 'condition') {
    return { combinator: 'and', rules: [] } satisfies ConditionNodeConfig
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
  agentId?: string // used while designing, to pull real field-extractor field names for condition rules — not (yet) bound at run time
  updatedAt: string
}
