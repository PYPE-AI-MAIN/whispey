/**
 * Workflow contract (schemaVersion 1.0) — Zod mirror of the canonical Pydantic
 * models at `pype-voice-agent/workflow/models.py`.
 *
 * The Whispey editor PRODUCES this shape; the backend interpreter CONSUMES it.
 * Any change here must be applied to models.py too, and vice-versa.
 */
import { z } from 'zod'

export const SCHEMA_VERSION = '1.0'

// ── provider blocks (mirror agent/<name>/config.yaml) ────────────────────────
export const sttConfig = z.object({
  name: z.string().default('deepgram'),
  model: z.string().nullish(),
  language: z.string().nullish().default('en'),
})

export const llmConfig = z.object({
  name: z.string().default('openai'),
  model: z.string().nullish(),
  temperature: z.number().nullish(),
})

export const ttsConfig = z.object({
  name: z.string().default('elevenlabs'),
  voice_id: z.string().nullish(),
  language: z.string().nullish(),
  model: z.string().nullish(),
  voice_settings: z.record(z.any()).nullish(),
})

export const vadConfig = z.object({
  name: z.string().default('silero'),
  min_silence_duration: z.number().nullish(),
})

export const turnDetectionConfig = z.object({
  mode: z.string().nullish(),
  model: z.string().nullish(),
})

export const agentConfig = z.object({
  globalPrompt: z.string().default(''),
  llm: llmConfig.default({ name: 'openai' }),
  stt: sttConfig.default({ name: 'deepgram' }),
  tts: ttsConfig.default({ name: 'elevenlabs' }),
  vad: vadConfig.nullish(),
  turnDetection: turnDetectionConfig.nullish(),
  advanced: z.record(z.any()).default({}),
})

// ── transports ────────────────────────────────────────────────────────────
export const transports = z.object({
  web: z.object({ enabled: z.boolean().default(true) }).nullish(),
  telephony: z
    .object({
      enabled: z.boolean().default(false),
      inbound: z.record(z.any()).nullish(),
      outbound: z.record(z.any()).nullish(),
      dtmf: z.record(z.any()).nullish(),
      amd: z.record(z.any()).nullish(),
    })
    .nullish(),
})

// ── variables ────────────────────────────────────────────────────────────
export const varType = z.enum(['string', 'number', 'boolean', 'object'])
export const variableDef = z.object({
  key: z.string(),
  type: varType.default('string'),
  default: z.any().nullish(),
  description: z.string().nullish(),
})

// ── nodes ────────────────────────────────────────────────────────────────
const position = z.object({ x: z.number().default(0), y: z.number().default(0) })
const nodeBase = { id: z.string(), name: z.string().nullish(), position: position.nullish() }

export const conversationNode = z.object({
  ...nodeBase,
  type: z.literal('conversation'),
  prompt: z.string().nullish(),
  staticText: z.string().nullish(),
  skipUserResponse: z.boolean().default(false),
  blockInterruptions: z.boolean().default(false),
  model: llmConfig.nullish(),
  voice: ttsConfig.nullish(),
  functions: z.array(z.string()).default([]),
})

export const extractionField = z.object({
  variable: z.string(),
  description: z.string().nullish(),
  type: varType.default('string'),
})
export const extractVariableNode = z.object({
  ...nodeBase,
  type: z.literal('extract_variable'),
  prompt: z.string().nullish(),
  extractions: z.array(extractionField).default([]),
})

export const logicSplitNode = z.object({ ...nodeBase, type: z.literal('logic_split') })

export const functionNode = z.object({
  ...nodeBase,
  type: z.literal('function'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  url: z.string().default(''),
  headers: z.record(z.any()).default({}),
  params: z.record(z.any()).default({}),
  body: z.any().nullish(),
  waitMessage: z.string().nullish(),
  saveAs: z.string().nullish(),
  timeout: z.number().nullish().default(20),
})

export const knowledgeNode = z.object({
  ...nodeBase,
  type: z.literal('knowledge'),
  query: z.string().nullish(),
  topK: z.number().default(4),
  knowledgeBase: z.string().nullish(),
  saveAs: z.string().nullish(),
})

export const callTransferNode = z.object({
  ...nodeBase,
  type: z.literal('call_transfer'),
  transferTo: z.string().default(''),
  mode: z.enum(['cold', 'warm']).default('cold'),
  message: z.string().nullish(),
})

export const pressDigitNode = z.object({
  ...nodeBase,
  type: z.literal('press_digit'),
  mode: z.enum(['send', 'collect']).default('send'),
  digits: z.string().nullish(),
  numDigits: z.number().nullish(),
  saveAs: z.string().nullish(),
})

export const smsNode = z.object({
  ...nodeBase,
  type: z.literal('sms'),
  to: z.string().nullish(),
  message: z.string().default(''),
  provider: z.string().nullish(),
})

export const subagentNode = z.object({
  ...nodeBase,
  type: z.literal('subagent'),
  prompt: z.string().default(''),
  model: llmConfig.nullish(),
  voice: ttsConfig.nullish(),
  functions: z.array(z.string()).default([]),
})

export const mcpNode = z.object({
  ...nodeBase,
  type: z.literal('mcp'),
  server: z.string().default(''),
  tool: z.string().default(''),
  args: z.record(z.any()).default({}),
  saveAs: z.string().nullish(),
})

export const codeNode = z.object({
  ...nodeBase,
  type: z.literal('code'),
  language: z.enum(['python', 'javascript']).default('python'),
  source: z.string().default(''),
  saveAs: z.string().nullish(),
})

export const endingNode = z.object({ ...nodeBase, type: z.literal('ending'), message: z.string().nullish() })
export const noteNode = z.object({ ...nodeBase, type: z.literal('note'), text: z.string().default('') })

export const anyNode = z.discriminatedUnion('type', [
  conversationNode,
  extractVariableNode,
  logicSplitNode,
  functionNode,
  knowledgeNode,
  callTransferNode,
  pressDigitNode,
  smsNode,
  subagentNode,
  mcpNode,
  codeNode,
  endingNode,
  noteNode,
])

export const LLM_NODE_TYPES = new Set(['conversation', 'extract_variable', 'subagent'])
export const NONRUNTIME_NODE_TYPES = new Set(['note'])
export const TELEPHONY_NODE_TYPES = new Set(['call_transfer', 'press_digit', 'sms'])

// ── edges ────────────────────────────────────────────────────────────────
export const edge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  kind: z.enum(['condition', 'logic', 'always', 'fallback']).default('always'),
  condition: z.string().nullish(),
  expression: z.string().nullish(),
  label: z.string().nullish(),
})

// ── top-level workflow ─────────────────────────────────────────────────────
export const metadata = z.object({ name: z.string().default(''), description: z.string().nullish() })

export const workflow = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  metadata: metadata.default({ name: '' }),
  agent: agentConfig.default({}),
  transports: transports.default({}),
  variables: z.array(variableDef).default([]),
  start: z.string(),
  nodes: z.array(anyNode).default([]),
  edges: z.array(edge).default([]),
})

// ── inferred types ─────────────────────────────────────────────────────────
export type Workflow = z.infer<typeof workflow>
export type WorkflowNode = z.infer<typeof anyNode>
export type NodeType = WorkflowNode['type']
export type Edge = z.infer<typeof edge>
export type EdgeKind = Edge['kind']
export type VariableDef = z.infer<typeof variableDef>
export type VarType = z.infer<typeof varType>
export type AgentConfig = z.infer<typeof agentConfig>

export function parseWorkflow(data: unknown): Workflow {
  return workflow.parse(data)
}

export function safeParseWorkflow(data: unknown) {
  return workflow.safeParse(data)
}

/** Minimal valid node for a given type — Zod fills in every field that has a `.default(...)`. */
export function createDefaultNode(
  type: NodeType,
  id: string,
  position: { x: number; y: number }
): WorkflowNode {
  return anyNode.parse({ id, type, position })
}
