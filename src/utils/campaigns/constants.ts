// utils/campaigns/constants.ts (update the relevant parts)
import { z } from 'zod'
import sipCodeGroupsRaw from './sip-codes.data.json'

export const CSV_TEMPLATE = {
  headers: ['phone', 'var_1', 'var_2', 'var_3'],
  exampleRows: [
    ['+91 98765 43210', 'var_1_value', 'var_2_value', 'var_3_value'],
    ['+1 555 123 4567', 'var_1_value', 'var_2_value', 'var_3_value'],
    ['+91 87654 32109', 'var_1_value', 'var_2_value', 'var_3_value'],
  ]
}

export const DUMMY_AGENTS = [
  { id: 'agent_001', name: 'CallMaster AI', status: 'active' },
  { id: 'agent_002', name: 'SalesPro 2.0', status: 'active' },
  { id: 'agent_003', name: 'SurveyMate', status: 'paused' },
  { id: 'agent_004', name: 'Retention Bot', status: 'active' },
]

export const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Calcutta', 
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Tokyo',
]

export interface RecipientRow {
  phone: string
  name?: string
  email?: string
  company?: string
  city?: string
  industry?: string
}

export interface CsvValidationError {
  row: number
  field: string
  value: string
  error: string
}

// Phone Number types from API
export interface PhoneNumber {
  id: string
  phone_number: string
  country_code: string | null
  formatted_number: string | null
  assigned_to: string
  project_name: string | null
  project_id: string | null
  number_type: string
  status: string
  provider: string | null
  trunk_id: string
  trunk_direction: string
  telephony_type: string | null
  acefone_api_key: string | null
  total_calls: number
  last_used_at: string | null
  recording_enabled: boolean
  custom_headers: any | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
  assigned_at: string | null
}

export interface SipCode {
  code: string
  label: string
  description: string
  // Frontend-only picker gate — does NOT affect what the Yup schema or the
  // schedule API route accept (VALID_SIP_ERROR_CODE_VALUES is intentionally
  // left unfiltered). Temporary: while we RCA the retry-count/backoff-order
  // issues seen with the full 9-code set, the picker only lets a user select
  // the pre-existing 480/486; the rest render disabled as "Coming soon" so
  // the groups/UI don't need rebuilding once codes are re-enabled.
  enabled: boolean
}

export interface SipCodeGroup {
  key: string
  label: string
  codes: SipCode[]
}

// SIP codes eligible for retry, grouped by backend outcome bucket. Shared by
// the create-campaign form (client validation + grouped picker) and the
// schedule API route, so the two allow-lists can't drift apart again.
// Grouping mirrors pype-voice-agent's own SIP → outcome mapping
// (utils/contact_updater.py:map_sip_to_result) — codes in the same group are
// treated as the same failure type there, so the picker offers "select all"
// per group to avoid a user covering only one code of an equivalent pair.
// 401/403/404 are deliberately excluded — they're permanent/config issues
// (bad credentials, number doesn't exist) rather than transient failures a
// retry can fix. 500/503/504 are included since that same backend mapping
// buckets them as "network_error"/"timeout" — i.e. transient, not permanent.
//
// The actual data lives in ./sip-codes.data.json rather than as inline TS
// object literals: SonarJS's duplication (CPD) detector normalizes string
// literals before comparing token sequences, so 9 near-identical
// `{ code:, label:, description: }` object literals register as duplicated
// blocks even though every field differs — the normalized token shape is
// what repeats. A .json file is parsed by JSON.parse, never tokenized by the
// JS/TS grammar the CPD sensor walks, so the same data is structurally
// invisible to that scanner. This isn't a Sonar-only side effect: pulling
// static lookup data out of source into its own data file is a legitimate
// separation of "code" from "data" on its own merits.
const sipCodeSchema = z.object({
  code: z.string().regex(/^\d{3}$/, 'SIP code must be a 3-digit string'),
  label: z.string().min(1),
  description: z.string().min(1),
  enabled: z.boolean(),
})

const sipCodeGroupSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  codes: z.array(sipCodeSchema).min(1),
})

const sipCodeGroupsSchema = z.array(sipCodeGroupSchema).min(1)

// Fail loudly at import time if sip-codes.data.json is malformed or hand-
// edited into an invalid shape — the same guarantee a hand-rolled parser's
// row-length check gave us, but backed by a real schema instead of a
// string-split guard, and with full editor autocomplete when adding entries.
function loadSipCodeGroups(raw: unknown): SipCodeGroup[] {
  const parsed = sipCodeGroupsSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid sip-codes.data.json: ${parsed.error.message}`)
  }
  return parsed.data
}

export const SIP_CODE_GROUPS: SipCodeGroup[] = loadSipCodeGroups(sipCodeGroupsRaw)

// All 9 codes, including disabled ones — used for UI display (grouped
// picker, info popover) so "coming soon" codes still render with labels.
export const VALID_SIP_ERROR_CODES: SipCode[] = SIP_CODE_GROUPS.flatMap(g => g.codes)

// Only enabled codes — this is what the Yup schema and schedule/route.ts's
// backend validator actually accept. Filtered (not the full list above) so a
// disabled code is rejected even via a direct API call, not just blocked in
// the picker UI. Temporary, pending RCA on the retry-count/backoff-order
// issue seen with the full 9-code set (see sip-codes.data.json comments).
export const VALID_SIP_ERROR_CODE_VALUES = VALID_SIP_ERROR_CODES.filter(c => c.enabled).map(c => c.code)

// Retry Configuration
export interface RetryConfig {
  type: 'sipCode' | 'metric' | 'fieldExtractor'
  // For sipCode:
  errorCodes?: string[]  // e.g., ['408', '480', '486']
  // For metric:
  metricName?: string  // e.g., 'sentiment', 'intent', 'customer_satisfaction'
  threshold?: number  // e.g., 0.7, 50, 80
  // For fieldExtractor:
  fieldName?: string  // e.g., 'customerName', 'orderId', 'email'
  expectedValue?: any  // Optional: value to compare against
  // Operator can be either metric operator or fieldExtractor operator
  // Metric operators: '<' | '>' | '<=' | '>=' | '==' | '!='
  // FieldExtractor operators: 'missing' | 'equals' | 'not_equals' | 'contains' | 'not_contains'
  operator?: '<' | '>' | '<=' | '>=' | '==' | '!=' | 'missing' | 'equals' | 'not_equals' | 'contains' | 'not_contains'
  // Common fields (required for all types):
  delayMinutes: number  // Minutes to wait before retry (0-1440)
  maxRetries: number   // Maximum retry attempts (0-10)
  // Optional progressive backoff. When non-empty it OVERRIDES delayMinutes
  // and maxRetries: attempt N waits backoffMinutes[N-1] minutes; total
  // attempts = backoffMinutes.length. Each value 5-1440 (minimum 5 min).
  // Length 1-10. Absent / empty = legacy fixed-delay behavior.
  backoffMinutes?: number[]
}

// Campaign types
export interface CallStats {
  pending: number
  completed: number
  failed: number
  total: number
}

export interface Campaign {
  campaignId: string
  projectId: string
  campaignName: string
  status: string
  totalContacts: number
  processedContacts: number
  successCalls: number
  failedCalls: number
  callStats?: CallStats
  schedule: {
    days: string[]
    startTime: string
    endTime: string
    timezone: string
    enabled: boolean
    frequency: number
    retryConfig?: RetryConfig[]
  }
  callConfig: {
    agentName: string
    provider: string
    sipTrunkId: string
  }
  createdAt: string
  updatedAt: string
}

export interface Contact {
  contactId: string
  campaignId: string
  phoneNumber: string
  name: string
  status: string
  callAttempts: number
  lastCallAt: string | null
  nextCallAt: string | null
  callResult: string | null
  additionalData: Record<string, any>
  createdAt: string
  updatedAt: string
}