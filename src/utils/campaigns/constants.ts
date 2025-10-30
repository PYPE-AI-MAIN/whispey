// utils/campaigns/constants.ts

export const CSV_TEMPLATE = {
  headers: ['phone', 'var1', 'var2', 'var3'],
  exampleRows: [
    ['+919876543210', 'var_1_Val', 'var_2_Val', 'var_3_Val'],
    ['+15551234567', 'var_1_Val', 'var_2_Val', 'var_3_Val'],
    ['+918765432109', 'var_1_Val', 'var_2_Val', 'var_3_Val'],
  ]
}

export const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Calcutta', 
  'America/New_York',
  'America/Los_Angeles', 
  'Europe/London',
  'Asia/Tokyo',
]

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