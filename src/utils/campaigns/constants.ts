// utils/campaigns/constants.ts

export const CSV_TEMPLATE = {
  headers: ['name', 'phone', 'email', 'company', 'city', 'industry'],
  exampleRows: [
    ['John Doe', '+1234567890', 'john.doe@example.com', 'Acme Corporation', 'New York', 'Technology'],
    ['Jane Smith', '+1234567891', 'jane.smith@example.com', 'Tech Solutions', 'San Francisco', 'Software'],
    ['Bob Johnson', '+1234567892', 'bob.johnson@example.com', 'Global Industries', 'Chicago', 'Manufacturing'],
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
  name: string
  phone: string
  email: string
  company: string
  city: string
  industry: string
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