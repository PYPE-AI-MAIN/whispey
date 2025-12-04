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
}

// Campaign types
export interface Campaign {
  campaignId: string
  projectId: string
  campaignName: string
  status: string
  totalContacts: number
  processedContacts: number
  successCalls: number
  failedCalls: number
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