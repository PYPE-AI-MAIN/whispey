// utils/campaigns/constants.ts (update the relevant parts)

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
export const SIP_CODE_GROUPS: SipCodeGroup[] = [
  {
    key: 'noAnswer',
    label: 'No Answer',
    codes: [
      { code: '480', label: 'Temporarily Unavailable', description: "Callee's device was reached but is currently unavailable (not registered, do-not-disturb, etc). May succeed on retry." },
      { code: '487', label: 'Request Terminated', description: 'Call was canceled/ended before being answered.' },
    ],
  },
  {
    key: 'busy',
    label: 'Busy',
    codes: [
      { code: '486', label: 'Busy Here', description: 'Callee is on another call. May succeed on retry once they hang up.' },
      { code: '600', label: 'Busy Everywhere', description: "Callee is busy or has do-not-disturb enabled across all their devices. May succeed once that's turned off." },
    ],
  },
  {
    key: 'timeout',
    label: 'Timeout',
    codes: [
      { code: '408', label: 'Request Timeout', description: "Server/network couldn't reach the destination in time. Usually a transient network issue." },
      { code: '504', label: 'Server Timeout', description: 'Upstream server took too long to respond. Same timeout bucket as 408 — usually transient.' },
    ],
  },
  {
    key: 'networkError',
    label: 'Network Error',
    codes: [
      { code: '500', label: 'Server Internal Error', description: 'Telephony server hit a transient internal error. Categorized as network_error — usually resolves on retry.' },
      { code: '503', label: 'Service Unavailable', description: 'Telephony server is overloaded or temporarily down. Categorized as network_error — often self-resolves.' },
    ],
  },
  {
    key: 'declined',
    label: 'Declined',
    codes: [
      { code: '603', label: 'Decline', description: 'Callee explicitly rejected the call. May still succeed at a different time.' },
    ],
  },
]

export const VALID_SIP_ERROR_CODES: SipCode[] = SIP_CODE_GROUPS.flatMap(g => g.codes)
export const VALID_SIP_ERROR_CODE_VALUES = VALID_SIP_ERROR_CODES.map(c => c.code)

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