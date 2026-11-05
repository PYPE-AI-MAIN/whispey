import { z } from 'zod'

/**
 * Runtime shape check for every argument set the model sends a Pi tool. The JSON schemas in
 * the route only advise the model — nothing enforces them — so a wrong type used to reach the
 * runner, and for a Confirm-gated tool it produced a confirm card for arguments that could
 * never run. Checked before a tool runs or a card is created; extra keys are allowed.
 */
const id = z.string().min(1).max(64).regex(/^[\w-]+$/, 'must be an id')
const text = (max: number) => z.string().max(max)
const count = z.union([z.number(), z.string().max(8)])
const flatMap = z.record(z.string().max(200), z.unknown())
// The same limits dispositions are saved under (lib/dispositions.ts), so a description that
// could never be saved is rejected here, before a Confirm card, with a message the model can act on.
const disposition = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, 'must be lowercase letters, digits and underscores, starting with a letter (max 40 characters)'),
  description: z.string().min(1, 'is empty').max(500, 'is over 500 characters: shorten the value names and conditions, or split it into separate dispositions'),
})

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  get_call_volume_trend: z.object({ days: count.optional(), agent_id: id.optional() }),
  get_completion_insights: z.object({ days: count.optional(), agent_id: id.optional() }),
  open_page: z.object({
    page: z.enum(['logs', 'overview', 'config', 'phone_calls', 'knowledge', 'qa', 'campaign_logs', 'agents', 'analytics', 'campaigns', 'campaign', 'settings', 'phone_settings', 'api_keys']),
    agent_id: id.optional(),
    campaign_id: text(64).optional(),
  }),
  list_agents: z.object({}),
  list_analytics_fields: z.object({ agent_id: id.optional() }),
  search_field_definitions: z.object({ agent_id: id, term: text(200).min(1) }),
  query_analytics: z.object({ agent_id: id.optional(), spec: z.record(z.string(), z.unknown()).optional() }).passthrough(),
  check_spam_number: z.object({ number: z.union([text(40), z.number()]) }),
  get_talk_link: z.object({ agent_id: id }),
  get_agent_details: z.object({ agent_id: id }),
  create_agent: z.object({
    display_name: text(120).min(1),
    prompt: text(200_000).optional(),
    greeting: text(4_000).optional(),
    voice_provider: text(40).optional(),
    voice_id: text(100).optional(),
    dispositions: z.array(disposition).max(200).optional(),
  }),
  open_custom_tool_form: z.object({
    agent_id: id,
    type: z.enum(['custom_function', 'end_call', 'knowledge_search', 'voicemail_detection', 'update_vad_options']).optional(),
    name: text(100).optional(),
    description: text(2_000).optional(),
    api_url: text(2_000).optional(),
    http_method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
    timeout: z.number().optional(),
    async: z.boolean().optional(),
    headers: flatMap.optional(),
    parameters: z.array(z.object({ name: text(100) }).passthrough()).max(50).optional(),
    custom_payload: text(20_000).optional(),
  }),
  edit_agent: z.object({
    agent_id: id,
    prompt: text(200_000).optional(),
    prompt_patch: z.object({ old_string: text(200_000), new_string: text(200_000) }).optional(),
    greeting: text(4_000).optional(),
    voice_provider: text(40).optional(),
    voice_id: text(100).optional(),
    llm_model: text(100).optional(),
    variables: flatMap.optional(),
    extractor_variables: z.unknown().optional(),
    dispositions: z.array(disposition).max(200).optional(),
    dispositions_mode: z.enum(['merge', 'replace']).optional(),
  }),
  list_phone_numbers: z.object({}),
  search_plivo_numbers: z.object({ country_iso: text(8), type: text(20).optional(), pattern: text(20).optional() }),
  buy_plivo_number: z.object({ number: text(32), country_iso: text(8) }),
  attach_inbound_number: z.object({ agent_id: id, number: text(32), krisp_enabled: z.boolean().optional() }),
}

export const PI_TOOL_NAMES = Object.keys(SCHEMAS)

/** null when the arguments are fine (or the tool is unknown — the caller reports that), else a message for the model. */
export function validateToolArgs(name: string, args: unknown): string | null {
  const schema = SCHEMAS[name]
  if (!schema) return null
  const parsed = schema.safeParse(args)
  if (parsed.success) return null
  const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`)
  return `Invalid arguments for ${name} — ${issues.join('; ')}. Fix them and call the tool again.`
}
