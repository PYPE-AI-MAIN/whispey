/**
 * Shared outbound-dispatch logic — used by the manual dial form
 * (phone-call-config) and by the call-logs "Call Again" action. Kept in one
 * place so both agree on what counts as "this agent can be dialed right now";
 * a mismatch here is a real customer getting an unexpected call, or a real
 * one silently failing.
 */

export interface DispatchAgent {
  id: string
  name: string
  agent_type: string
  is_active: boolean
}

export interface RunningAgent {
  agent_name: string
  pid: number
  status: string
}

export interface PhoneNumber {
  id: string
  phone_number: string
  formatted_number: string | null
  provider: string | null
  trunk_id: string | null
  country_code: string | null
  status: string
  trunk_direction: string
  number_type: string | null
  project_id: string | null
  project_name: string | null
}

export function formatNumberLabel(phone: PhoneNumber): string {
  const num = phone.formatted_number || phone.phone_number
  const kind = phone.number_type === 'acefone_bridge' || phone.number_type === 'plivo_bridge' ? 'bridge' : 'SIP'
  const provider = phone.provider || ''
  const dir = phone.trunk_direction || ''
  const parts = [kind, provider, dir].filter(Boolean)
  return `${num} (${parts.join(' · ')})`
}

/** Only `pype_agent` agents run as a dispatchable process — every other agent
 * type has no "running" concept at all, so it's reported not-running here. */
export function getRunningAgentName(
  agent: DispatchAgent,
  runningAgents: RunningAgent[]
): { isRunning: boolean; agentName: string | null } {
  if (agent.agent_type !== 'pype_agent' || !runningAgents.length) return { isRunning: false, agentName: null }
  const sanitizedAgentId = agent.id.replaceAll('-', '_')
  const newFormat = `${agent.name}_${sanitizedAgentId}`
  let runningAgent = runningAgents.find((ra) => ra.agent_name === newFormat)
  if (runningAgent) return { isRunning: true, agentName: newFormat }
  runningAgent = runningAgents.find((ra) => ra.agent_name === agent.name)
  if (runningAgent) return { isRunning: true, agentName: agent.name }
  return { isRunning: false, agentName: null }
}

export type DispatchValidation =
  | { ok: false; error: string | null }
  | { ok: true; cleaned: string; selectedPhone: PhoneNumber; agentName: string }

// E.164 bounds — the shortest real numbers (a few Pacific island plans) run
// about 8 digits, and 15 is the format's own hard maximum. A stored
// customer_number outside this range isn't a phone number at all (seen in
// production: some rows carry a 45+ digit garbled value), so it's rejected
// here rather than handed to a telephony provider.
const MIN_PHONE_DIGITS = 8
const MAX_PHONE_DIGITS = 15

export function looksLikePhoneNumber(value: string): boolean {
  const digits = value.replaceAll(/\D/g, '')
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS
}

/** For display only — a garbled number (production has rows 45+ digits long)
 * shouldn't be able to blow out a title or button's layout. */
export function formatDisplayNumber(value: string, maxLength = 20): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

/** `error: null` means silently no-op (no agent / empty field) rather than a message worth showing. */
export function validateDispatch(
  hasAgent: boolean,
  phoneNumber: string,
  fromPhoneNumberId: string,
  phoneNumbers: PhoneNumber[],
  running: { isRunning: boolean; agentName: string | null }
): DispatchValidation {
  if (!hasAgent || !phoneNumber.trim()) return { ok: false, error: null }
  const cleaned = phoneNumber.replaceAll(/\D/g, '')
  if (cleaned.length < MIN_PHONE_DIGITS || cleaned.length > MAX_PHONE_DIGITS) {
    return { ok: false, error: 'Please enter a valid phone number' }
  }
  if (!fromPhoneNumberId.trim()) return { ok: false, error: 'Please select a phone number to call from' }
  const selectedPhone = phoneNumbers.find((p) => p.id === fromPhoneNumberId)
  if (!selectedPhone) return { ok: false, error: 'Selected phone number not found' }
  const isBridge = selectedPhone.number_type === 'acefone_bridge' || selectedPhone.number_type === 'plivo_bridge'
  if (!isBridge && !selectedPhone.trunk_id) return { ok: false, error: 'Selected phone number is missing trunk ID' }
  if (!running.isRunning || !running.agentName) {
    return { ok: false, error: 'Agent is not currently running. Please start the agent first.' }
  }
  return { ok: true, cleaned, selectedPhone, agentName: running.agentName }
}

export function isDispatchDisabled(
  agent: DispatchAgent,
  runningStatus: { isRunning: boolean; agentName: string | null },
  isCheckingRunning: boolean,
  isLoading: boolean,
  phoneNumber: string,
  fromPhoneNumberId: string
): boolean {
  if (isLoading || !phoneNumber.trim() || !fromPhoneNumberId.trim() || isCheckingRunning) return true
  if (agent.agent_type === 'pype_agent') return !runningStatus.isRunning
  return !agent.is_active
}

/** Turn a failed dispatch response into a user-facing message. */
export function extractDispatchError(result: any, status: number): string {
  if (status === 429) {
    return result.current_calls === undefined
      ? 'Rate limit exceeded. Please try again later.'
      : `Rate limit exceeded. Current calls: ${result.current_calls}/${result.max_calls}. Please try again later.`
  }
  if (typeof result.error === 'string') return result.error
  if (result.error?.message) return result.error.message
  if (typeof result.message === 'string') return result.message
  return 'Failed to dispatch call'
}

/** Build the {{key: value}} variables object sent with the dispatch request. */
export function buildDispatchVariables(variables: { key: string; value: string }[]): Record<string, string> {
  return Object.fromEntries(
    variables.filter((v) => v.key.trim()).map((v) => [v.key.trim(), v.value])
  )
}

/**
 * Candidate "variables" out of a call's stored `metadata` — only its flat,
 * primitive top-level fields. `metadata` also carries large structural blobs
 * (`complete_configuration`, `context_memory_turns`, `usage`, ...); those are
 * objects/arrays and a dispatch variable must be a flat string, so they're
 * dropped rather than guessed at.
 */
export function extractCandidateVariables(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value)
    }
  }
  return out
}
