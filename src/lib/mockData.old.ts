// Mock Data Service - JSON File Persistent Storage!
// Perfect for demos - data persists across sessions with JSON file storage

import { jsonFileService } from './jsonFileService'

// Types for our mock data
export interface MockProject {
  id: string
  name: string
  description: string
  environment: string
  owner_clerk_id: string
  created_at: string
  updated_at: string
  is_active: boolean
  user_role: string
  api_token?: string
}

export interface MockAgent {
  id: string
  name: string
  agent_type: string
  configuration: any
  project_id: string
  environment: string
  created_at: string
  updated_at: string
  is_active: boolean
  user_id?: string
  field_extractor?: boolean
  field_extractor_prompt?: string
  field_extractor_keys?: string[]
}

export interface MockCallLog {
  id: string
  call_id: string
  agent_id: string
  customer_number: string
  call_ended_reason: string
  transcript_type: string
  transcript_json: any
  metadata: any
  dynamic_variables: any
  environment: string
  created_at: string
  call_started_at: string
  call_ended_at: string
  duration_seconds: number
  recording_url: string
  avg_latency: number
  transcription_metrics: any
  total_stt_cost: number
  total_tts_cost: number
  total_llm_cost: number
}

export interface MockUser {
  id: string
  clerk_id: string
  email: string
  first_name: string
  last_name: string
  profile_image_url: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface MockTranscriptLog {
  id: string
  session_id: string
  turn_id: string
  user_transcript: string
  agent_response: string
  stt_metrics: {
    duration: number
    confidence: number
  }
  llm_metrics: {
    ttft: number // Time to first token
    tokens_per_second: number
    total_tokens: number
  }
  tts_metrics: {
    ttfb: number // Time to first byte
    audio_duration: number
    synthesis_time: number
  }
  eou_metrics: {
    end_of_utterance_delay: number
    confidence: number
  }
  lesson_day: number
  created_at: string
  unix_timestamp: number
  phone_number: string
  call_duration: number
  call_success: boolean
  lesson_completed: boolean
}

export interface CustomOverviewMetric {
  id: string
  name: string
  value: number | string
  previousValue?: number
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
  unit?: string
  prefix?: string
  suffix?: string
  icon: string
  color: string
  description: string
  agentId?: string
  projectId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Mock Data Storage (JSON file-based persistence)
class MockDataStore {
  private projects: MockProject[] = []
  private agents: MockAgent[] = []
  private callLogs: MockCallLog[] = []
  private customOverviewMetrics: CustomOverviewMetric[] = []
  private transcriptLogs: any[] = []
  private users: any[] = []
  private listeners: Map<string, ((data: any) => void)[]> = new Map()

  constructor() {
    if (typeof window !== 'undefined') {
      // Initialize with dummy data first, then sync with API
      this.initializeDummyData()
      console.log('🎯 Initialized with dummy data, syncing with API...')
      
      // Always sync with API on initialization
      this.syncWithAPI()
    } else {
      // Server-side: just initialize with dummy data
      this.initializeDummyData()
    }
  }

  // Event system for real-time updates
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: (data: any) => void) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data))
    }
  }

  private loadDataFromStorage() {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        this.initializeDummyData()
        return
      }

      // Try to load data from localStorage
      const savedProjects = localStorage.getItem('mockData_projects')
      const savedAgents = localStorage.getItem('mockData_agents')
      const savedCallLogs = localStorage.getItem('mockData_callLogs')
      const savedMetrics = localStorage.getItem('mockData_metrics')
      const savedTranscriptLogs = localStorage.getItem('mockData_transcriptLogs')
      const savedUsers = localStorage.getItem('mockData_users')

      // Check if localStorage data is stale for agent_001
      let needsRefresh = false
      if (savedCallLogs) {
        try {
          const callLogs = JSON.parse(savedCallLogs)
          const agent001Calls = callLogs.filter((c: any) => c.agent_id === 'agent_001')
          if (agent001Calls.length < 4) {
            console.log(`🎯 MockDataStore: Found only ${agent001Calls.length} calls for agent_001, need refresh`)
            needsRefresh = true
          }
        } catch (e) {
          needsRefresh = true
        }
      } else {
        needsRefresh = true
      }

      if (!needsRefresh && savedProjects && savedAgents && savedCallLogs && savedMetrics) {
        // Load from localStorage if all data exists and is current
        this.projects = JSON.parse(savedProjects)
        this.agents = JSON.parse(savedAgents)
        this.callLogs = JSON.parse(savedCallLogs)
        this.customOverviewMetrics = JSON.parse(savedMetrics)
        this.transcriptLogs = savedTranscriptLogs ? JSON.parse(savedTranscriptLogs) : []
        this.users = savedUsers ? JSON.parse(savedUsers) : this.getDefaultUsers()
        
        console.log('📦 Loaded current data from localStorage')
      } else {
        // Data is stale or missing - initialize with dummy data and trigger sync
        this.initializeDummyData()
        this.saveDataToStorage()
        console.log('🎯 Initialized with dummy data, will sync with API')
        
        // Trigger sync in next tick to avoid blocking initialization
        setTimeout(() => this.syncWithAPI(), 100)
      }
      
      // Try to sync with JSON API in the background
      this.syncWithAPI()
    } catch (error) {
      console.error('Error loading data from storage:', error)
      this.initializeDummyData()
    }
  }

  private saveDataToStorage() {
    try {
      if (typeof window === 'undefined') return

      localStorage.setItem('mockData_projects', JSON.stringify(this.projects))
      localStorage.setItem('mockData_agents', JSON.stringify(this.agents))
      localStorage.setItem('mockData_callLogs', JSON.stringify(this.callLogs))
      localStorage.setItem('mockData_metrics', JSON.stringify(this.customOverviewMetrics))
      localStorage.setItem('mockData_transcriptLogs', JSON.stringify(this.transcriptLogs))
      localStorage.setItem('mockData_users', JSON.stringify(this.users))
      
      console.log('💾 Data saved to localStorage')
    } catch (error) {
      console.error('Error saving data to storage:', error)
    }
  }

  // Sync with JSON API in the background
  async syncWithAPI() {
    try {
      if (typeof window === 'undefined') return // Skip on server-side
      
      const response = await fetch('/api/data?type=current')
      if (!response.ok) throw new Error('API request failed')
      
      const apiData = await response.json()
      
      // Update data if API has newer/different data
      if (apiData.projects) this.projects = apiData.projects
      if (apiData.agents) this.agents = apiData.agents
      if (apiData.callLogs) this.callLogs = apiData.callLogs
      if (apiData.customOverviewMetrics) this.customOverviewMetrics = apiData.customOverviewMetrics
      
      // Save updated data to localStorage
      this.saveDataToStorage()
      
      // Emit events to notify components of data changes
      this.emit('data:changed', { type: 'sync', source: 'api' })
      
      console.log('🔄 Synced data with JSON API')
    } catch (error) {
      console.warn('Failed to sync with API:', error)
    }
  }

  private getDefaultUsers(): MockUser[] {
    return [
      {
        id: 'user_001',
        clerk_id: 'user_demo_123',
        email: 'demo@example.com',
        first_name: 'Demo',
        last_name: 'User',
        profile_image_url: 'https://via.placeholder.com/150',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_active: true
      }
    ]
  }

  private initializeDummyData() {
    // Initialize with comprehensive realistic dummy data
    this.projects = [
      {
        id: 'proj_001',
        name: 'Customer Support Hub',
        description: 'AI-powered customer support voice agents for handling inquiries and complaints',
        environment: 'production',
        owner_clerk_id: 'user_demo_123',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        is_active: true,
        user_role: 'owner',
        api_token: 'pype_demo_token_001'
      },
      {
        id: 'proj_002',
        name: 'Sales Outreach Campaign',
        description: 'Automated sales calling system for lead generation and follow-ups',
        environment: 'dev',
        owner_clerk_id: 'user_demo_123',
        created_at: '2024-01-10T14:20:00Z',
        updated_at: '2024-01-10T14:20:00Z',
        is_active: true,
        user_role: 'owner',
        api_token: 'pype_demo_token_002'
      },
      {
        id: 'proj_003',
        name: 'Healthcare Appointment Bot',
        description: 'Voice assistant for scheduling and managing healthcare appointments',
        environment: 'staging',
        owner_clerk_id: 'user_demo_123',
        created_at: '2024-01-05T09:15:00Z',
        updated_at: '2024-01-05T09:15:00Z',
        is_active: true,
        user_role: 'owner',
        api_token: 'pype_demo_token_003'
      },
      {
        id: 'proj_004',
        name: 'E-commerce Order Assistant',
        description: 'Automated order tracking and customer service for online retailers',
        environment: 'production',
        owner_clerk_id: 'user_demo_123',
        created_at: '2024-01-20T16:45:00Z',
        updated_at: '2024-01-20T16:45:00Z',
        is_active: true,
        user_role: 'owner',
        api_token: 'pype_demo_token_004'
      },
      {
        id: 'proj_005',
        name: 'Real Estate Lead Qualifier',
        description: 'AI agent for qualifying real estate leads and scheduling property viewings',
        environment: 'production',
        owner_clerk_id: 'user_demo_123',
        created_at: '2024-01-25T11:20:00Z',
        updated_at: '2024-01-25T11:20:00Z',
        is_active: true,
        user_role: 'owner',
        api_token: 'pype_demo_token_005'
      },
      {
        id: 'proj_006',
        name: 'Restaurant Reservation System',
        description: 'Voice bot for handling restaurant reservations and menu inquiries',
        environment: 'staging',
        owner_clerk_id: 'user_demo_123',
        created_at: '2024-01-30T14:10:00Z',
        updated_at: '2024-01-30T14:10:00Z',
        is_active: true,
        user_role: 'owner',
        api_token: 'pype_demo_token_006'
      }
    ]

    this.agents = [
      {
        id: 'agent_001',
        name: 'Support Agent Alpha',
        agent_type: 'inbound',
        configuration: {
          language: 'en-US',
          voice: 'neural',
          personality: 'helpful',
          max_call_duration: 600
        },
        project_id: 'proj_001',
        environment: 'production',
        created_at: '2024-01-15T11:00:00Z',
        updated_at: '2024-01-15T11:00:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: JSON.stringify([
          { field: 'customer_issue', description: 'Main customer problem or inquiry' },
          { field: 'sentiment', description: 'Customer emotional state (positive/negative/neutral)' },
          { field: 'urgency', description: 'Issue urgency level (low/medium/high)' }
        ]),
        field_extractor_keys: ['customer_issue', 'sentiment', 'urgency']
      },
      {
        id: 'agent_002',
        name: 'Support Agent Beta',
        agent_type: 'inbound',
        configuration: {
          language: 'en-US',
          voice: 'standard',
          personality: 'professional',
          max_call_duration: 480
        },
        project_id: 'proj_001',
        environment: 'production',
        created_at: '2024-01-15T11:30:00Z',
        updated_at: '2024-01-15T11:30:00Z',
        is_active: true,
        field_extractor: false
      },
      {
        id: 'agent_003',
        name: 'Sales Caller Pro',
        agent_type: 'outbound',
        configuration: {
          language: 'en-US',
          voice: 'neural',
          personality: 'persuasive',
          max_call_duration: 300
        },
        project_id: 'proj_002',
        environment: 'dev',
        created_at: '2024-01-10T15:00:00Z',
        updated_at: '2024-01-10T15:00:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: JSON.stringify([
          { field: 'lead_interest', description: 'Level of interest shown by prospect (low/medium/high)' },
          { field: 'next_steps', description: 'Agreed next steps or follow-up actions' },
          { field: 'budget_range', description: 'Prospect budget range if discussed' }
        ]),
        field_extractor_keys: ['lead_interest', 'next_steps', 'budget_range']
      },
      {
        id: 'agent_004',
        name: 'Appointment Assistant',
        agent_type: 'inbound',
        configuration: {
          language: 'en-US',
          voice: 'neural',
          personality: 'caring',
          max_call_duration: 420
        },
        project_id: 'proj_003',
        environment: 'staging',
        created_at: '2024-01-05T10:00:00Z',
        updated_at: '2024-01-05T10:00:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: JSON.stringify([
          { field: 'appointment_type', description: 'Type of medical appointment requested' },
          { field: 'preferred_date', description: 'Patient preferred appointment date' },
          { field: 'patient_info', description: 'Key patient information and contact details' }
        ]),
        field_extractor_keys: ['appointment_type', 'preferred_date', 'patient_info']
      },
      {
        id: 'agent_005',
        name: 'Order Tracking Bot',
        agent_type: 'inbound',
        configuration: {
          language: 'en-US',
          voice: 'neural',
          personality: 'efficient',
          max_call_duration: 300
        },
        project_id: 'proj_004',
        environment: 'production',
        created_at: '2024-01-20T17:00:00Z',
        updated_at: '2024-01-20T17:00:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: JSON.stringify([
          { field: 'order_number', description: 'Customer order reference number' },
          { field: 'issue_type', description: 'Type of order issue (tracking, returns, refunds)' },
          { field: 'resolution', description: 'How the issue was resolved' }
        ]),
        field_extractor_keys: ['order_number', 'issue_type', 'resolution']
      },
      {
        id: 'agent_006',
        name: 'Property Lead Qualifier',
        agent_type: 'outbound',
        configuration: {
          language: 'en-US',
          voice: 'neural',
          personality: 'professional',
          max_call_duration: 450
        },
        project_id: 'proj_005',
        environment: 'production',
        created_at: '2024-01-25T11:45:00Z',
        updated_at: '2024-01-25T11:45:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: JSON.stringify([
          { field: 'property_interest', description: 'Type of property customer is interested in' },
          { field: 'budget_range', description: 'Customer budget range for property purchase' },
          { field: 'viewing_scheduled', description: 'Whether property viewing was scheduled' }
        ]),
        field_extractor_keys: ['property_interest', 'budget_range', 'viewing_scheduled']
      },
      {
        id: 'agent_007',
        name: 'Restaurant Reservation Agent',
        agent_type: 'inbound',
        configuration: {
          language: 'en-US',
          voice: 'neural',
          personality: 'friendly',
          max_call_duration: 240
        },
        project_id: 'proj_006',
        environment: 'staging',
        created_at: '2024-01-30T14:30:00Z',
        updated_at: '2024-01-30T14:30:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: JSON.stringify([
          { field: 'party_size', description: 'Number of people for reservation' },
          { field: 'preferred_time', description: 'Customer preferred dining time' },
          { field: 'special_requests', description: 'Any special dietary requirements or requests' }
        ]),
        field_extractor_keys: ['party_size', 'preferred_time', 'special_requests']
      },
      {
        id: 'agent_008',
        name: 'Support Agent Gamma',
        agent_type: 'inbound',
        configuration: {
          language: 'en-US',
          voice: 'standard',
          personality: 'patient',
          max_call_duration: 600
        },
        project_id: 'proj_001',
        environment: 'production',
        created_at: '2024-01-16T09:15:00Z',
        updated_at: '2024-01-16T09:15:00Z',
        is_active: true,
        field_extractor: false
      },
      {
        id: 'agent_009',
        name: 'Sales Follow-up Agent',
        agent_type: 'outbound',
        configuration: {
          language: 'en-US',
          voice: 'neural',
          personality: 'persistent',
          max_call_duration: 360
        },
        project_id: 'proj_002',
        environment: 'dev',
        created_at: '2024-01-11T10:30:00Z',
        updated_at: '2024-01-11T10:30:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: JSON.stringify([
          { field: 'follow_up_reason', description: 'Reason for follow-up call' },
          { field: 'customer_response', description: 'Customer response to follow-up' },
          { field: 'next_contact_date', description: 'When to contact customer next' }
        ]),
        field_extractor_keys: ['follow_up_reason', 'customer_response', 'next_contact_date']
      },
      {
        id: 'agent_010',
        name: 'Emergency Appointment Handler',
        agent_type: 'inbound',
        configuration: {
          language: 'en-US',
          voice: 'neural',
          personality: 'calm',
          max_call_duration: 300
        },
        project_id: 'proj_003',
        environment: 'staging',
        created_at: '2024-01-06T08:45:00Z',
        updated_at: '2024-01-06T08:45:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: JSON.stringify([
          { field: 'emergency_type', description: 'Type of medical emergency or urgency' },
          { field: 'symptoms', description: 'Patient reported symptoms' },
          { field: 'action_taken', description: 'Immediate action taken or referral made' }
        ]),
        field_extractor_keys: ['emergency_type', 'symptoms', 'action_taken']
      }
    ]

    this.callLogs = [
      // Customer Support Hub calls
      {
        id: 'call_001',
        call_id: 'call_demo_001',
        agent_id: 'agent_001',
        customer_number: '+1-555-0101',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'customer', text: 'Hi, I need help with my account' },
            { speaker: 'agent', text: 'I\'d be happy to help you with your account. What specific issue are you experiencing?' },
            { speaker: 'customer', text: 'I can\'t log into my account' },
            { speaker: 'agent', text: 'I understand. Let me help you reset your password.' }
          ]
        },
        metadata: { customer_satisfaction: 4.5, issue_resolved: true, customer_issue: 'login_problem', sentiment: 'neutral', urgency: 'medium' },
        dynamic_variables: {},
        environment: 'production',
        created_at: '2024-01-16T09:30:00Z',
        call_started_at: '2024-01-16T09:30:00Z',
        call_ended_at: '2024-01-16T09:33:45Z',
        duration_seconds: 225,
        recording_url: 'https://demo-recordings.com/call_001.mp3',
        avg_latency: 0.8,
        transcription_metrics: { accuracy: 0.95 },
        total_stt_cost: 0.05,
        total_tts_cost: 0.08,
        total_llm_cost: 0.12
      },
      {
        id: 'call_002',
        call_id: 'call_demo_002',
        agent_id: 'agent_001',
        customer_number: '+1-555-0102',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'customer', text: 'I want to cancel my subscription' },
            { speaker: 'agent', text: 'I\'m sorry to hear you want to cancel. Can I ask what prompted this decision?' },
            { speaker: 'customer', text: 'The service is too expensive' },
            { speaker: 'agent', text: 'I understand. Let me see if we have any promotions that might work better for you.' }
          ]
        },
        metadata: { customer_satisfaction: 3.8, issue_resolved: false, customer_issue: 'cancellation_request', sentiment: 'negative', urgency: 'high' },
        dynamic_variables: {},
        environment: 'production',
        created_at: '2024-01-16T10:15:00Z',
        call_started_at: '2024-01-16T10:15:00Z',
        call_ended_at: '2024-01-16T10:21:30Z',
        duration_seconds: 390,
        recording_url: 'https://demo-recordings.com/call_002.mp3',
        avg_latency: 0.9,
        transcription_metrics: { accuracy: 0.92 },
        total_stt_cost: 0.08,
        total_tts_cost: 0.14,
        total_llm_cost: 0.21
      },
      {
        id: 'call_003',
        call_id: 'call_demo_003',
        agent_id: 'agent_002',
        customer_number: '+1-555-0103',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'customer', text: 'My order hasn\'t arrived yet' },
            { speaker: 'agent', text: 'I apologize for the delay. Let me check your order status immediately.' },
            { speaker: 'customer', text: 'Order number is ORD-12345' },
            { speaker: 'agent', text: 'I see your order was shipped yesterday and should arrive tomorrow. I\'ll send you tracking information.' }
          ]
        },
        metadata: { customer_satisfaction: 4.2, issue_resolved: true },
        dynamic_variables: {},
        environment: 'production',
        created_at: '2024-01-16T11:00:00Z',
        call_started_at: '2024-01-16T11:00:00Z',
        call_ended_at: '2024-01-16T11:04:15Z',
        duration_seconds: 255,
        recording_url: 'https://demo-recordings.com/call_003.mp3',
        avg_latency: 0.7,
        transcription_metrics: { accuracy: 0.94 },
        total_stt_cost: 0.06,
        total_tts_cost: 0.09,
        total_llm_cost: 0.15
      },
      // Sales calls
      {
        id: 'call_004',
        call_id: 'call_demo_004',
        agent_id: 'agent_003',
        customer_number: '+1-555-0104',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'agent', text: 'Hi, I\'m calling about our new CRM solution. Do you have a few minutes?' },
            { speaker: 'customer', text: 'Sure, what kind of CRM?' },
            { speaker: 'agent', text: 'It\'s designed specifically for small businesses to manage customer relationships more effectively.' },
            { speaker: 'customer', text: 'That sounds interesting. Can you send me more information?' },
            { speaker: 'agent', text: 'Absolutely! I\'ll also schedule a demo for next week if you\'re interested.' }
          ]
        },
        metadata: { lead_interest: 'high', follow_up_required: true, next_steps: 'demo_scheduled', budget_range: 'mid_tier' },
        dynamic_variables: {},
        environment: 'dev',
        created_at: '2024-01-16T14:00:00Z',
        call_started_at: '2024-01-16T14:00:00Z',
        call_ended_at: '2024-01-16T14:05:20Z',
        duration_seconds: 320,
        recording_url: 'https://demo-recordings.com/call_004.mp3',
        avg_latency: 0.6,
        transcription_metrics: { accuracy: 0.97 },
        total_stt_cost: 0.07,
        total_tts_cost: 0.11,
        total_llm_cost: 0.18
      },
      {
        id: 'call_005',
        call_id: 'call_demo_005',
        agent_id: 'agent_009',
        customer_number: '+1-555-0105',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'agent', text: 'Hi, this is a follow-up call about the CRM demo we scheduled last week.' },
            { speaker: 'customer', text: 'Yes, I\'ve been thinking about it. The pricing seems a bit high for our budget.' },
            { speaker: 'agent', text: 'I understand. Let me see if we have any special pricing options available.' },
            { speaker: 'customer', text: 'That would be great. We\'re looking at a 6-month commitment initially.' }
          ]
        },
        metadata: { follow_up_reason: 'pricing_concern', customer_response: 'interested_with_conditions', next_contact_date: '2024-01-23' },
        dynamic_variables: {},
        environment: 'dev',
        created_at: '2024-01-17T10:30:00Z',
        call_started_at: '2024-01-17T10:30:00Z',
        call_ended_at: '2024-01-17T10:36:45Z',
        duration_seconds: 405,
        recording_url: 'https://demo-recordings.com/call_005.mp3',
        avg_latency: 0.8,
        transcription_metrics: { accuracy: 0.93 },
        total_stt_cost: 0.09,
        total_tts_cost: 0.15,
        total_llm_cost: 0.23
      },
      // Healthcare calls
      {
        id: 'call_006',
        call_id: 'call_demo_006',
        agent_id: 'agent_004',
        customer_number: '+1-555-0106',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'customer', text: 'I need to schedule an appointment with Dr. Smith' },
            { speaker: 'agent', text: 'I\'d be happy to help you schedule that. What type of appointment do you need?' },
            { speaker: 'customer', text: 'It\'s for a regular checkup' },
            { speaker: 'agent', text: 'Perfect. Dr. Smith has availability next Tuesday at 2 PM or Thursday at 10 AM. Which works better for you?' }
          ]
        },
        metadata: { appointment_type: 'regular_checkup', preferred_date: '2024-01-23', patient_info: 'existing_patient' },
        dynamic_variables: {},
        environment: 'staging',
        created_at: '2024-01-16T13:15:00Z',
        call_started_at: '2024-01-16T13:15:00Z',
        call_ended_at: '2024-01-16T13:18:30Z',
        duration_seconds: 195,
        recording_url: 'https://demo-recordings.com/call_006.mp3',
        avg_latency: 0.5,
        transcription_metrics: { accuracy: 0.96 },
        total_stt_cost: 0.04,
        total_tts_cost: 0.07,
        total_llm_cost: 0.11
      },
      {
        id: 'call_007',
        call_id: 'call_demo_007',
        agent_id: 'agent_010',
        customer_number: '+1-555-0107',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'customer', text: 'I need an urgent appointment. I\'ve been having chest pains.' },
            { speaker: 'agent', text: 'I understand this is urgent. How long have you been experiencing chest pains?' },
            { speaker: 'customer', text: 'Started about 2 hours ago' },
            { speaker: 'agent', text: 'I\'m going to connect you with our emergency triage nurse immediately and also schedule you for the earliest available slot today.' }
          ]
        },
        metadata: { emergency_type: 'chest_pain', symptoms: 'acute_chest_pain_2hrs', action_taken: 'emergency_triage_referral' },
        dynamic_variables: {},
        environment: 'staging',
        created_at: '2024-01-16T15:45:00Z',
        call_started_at: '2024-01-16T15:45:00Z',
        call_ended_at: '2024-01-16T15:47:15Z',
        duration_seconds: 135,
        recording_url: 'https://demo-recordings.com/call_007.mp3',
        avg_latency: 0.4,
        transcription_metrics: { accuracy: 0.98 },
        total_stt_cost: 0.03,
        total_tts_cost: 0.05,
        total_llm_cost: 0.08
      },
      // E-commerce calls
      {
        id: 'call_008',
        call_id: 'call_demo_008',
        agent_id: 'agent_005',
        customer_number: '+1-555-0108',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'customer', text: 'I need to track my order. The number is ORD-98765' },
            { speaker: 'agent', text: 'Let me look that up for you right away.' },
            { speaker: 'customer', text: 'It was supposed to arrive yesterday' },
            { speaker: 'agent', text: 'I see there was a delay with the shipping carrier. Your order is now scheduled for delivery today before 6 PM. I\'ll also apply a shipping credit to your account.' }
          ]
        },
        metadata: { order_number: 'ORD-98765', issue_type: 'tracking_delay', resolution: 'shipping_credit_applied' },
        dynamic_variables: {},
        environment: 'production',
        created_at: '2024-01-17T09:20:00Z',
        call_started_at: '2024-01-17T09:20:00Z',
        call_ended_at: '2024-01-17T09:23:10Z',
        duration_seconds: 190,
        recording_url: 'https://demo-recordings.com/call_008.mp3',
        avg_latency: 0.6,
        transcription_metrics: { accuracy: 0.95 },
        total_stt_cost: 0.04,
        total_tts_cost: 0.07,
        total_llm_cost: 0.10
      },
      // Real Estate calls
      {
        id: 'call_009',
        call_id: 'call_demo_009',
        agent_id: 'agent_006',
        customer_number: '+1-555-0109',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'agent', text: 'Hi, I\'m calling about your interest in properties in the downtown area.' },
            { speaker: 'customer', text: 'Yes, I\'m looking for a 2-bedroom condo' },
            { speaker: 'agent', text: 'Great! What\'s your budget range for this purchase?' },
            { speaker: 'customer', text: 'Around $300,000 to $350,000' },
            { speaker: 'agent', text: 'Perfect. I have several properties in that range. Would you like to schedule a viewing this weekend?' }
          ]
        },
        metadata: { property_interest: '2br_condo_downtown', budget_range: '300k_350k', viewing_scheduled: 'yes_weekend' },
        dynamic_variables: {},
        environment: 'production',
        created_at: '2024-01-17T11:00:00Z',
        call_started_at: '2024-01-17T11:00:00Z',
        call_ended_at: '2024-01-17T11:06:30Z',
        duration_seconds: 390,
        recording_url: 'https://demo-recordings.com/call_009.mp3',
        avg_latency: 0.7,
        transcription_metrics: { accuracy: 0.94 },
        total_stt_cost: 0.09,
        total_tts_cost: 0.14,
        total_llm_cost: 0.22
      },
      // Restaurant calls
      {
        id: 'call_010',
        call_id: 'call_demo_010',
        agent_id: 'agent_007',
        customer_number: '+1-555-0110',
        call_ended_reason: 'completed',
        transcript_type: 'final',
        transcript_json: {
          conversation: [
            { speaker: 'customer', text: 'I\'d like to make a reservation for tonight' },
            { speaker: 'agent', text: 'I\'d be happy to help! How many people will be dining with us?' },
            { speaker: 'customer', text: 'Table for 4, around 7 PM if possible' },
            { speaker: 'agent', text: 'Perfect! I have availability at 7:15 PM. Any special dietary requirements?' },
            { speaker: 'customer', text: 'One person is vegetarian' },
            { speaker: 'agent', text: 'Noted! Your reservation is confirmed for 4 people at 7:15 PM with vegetarian options.' }
          ]
        },
        metadata: { party_size: '4', preferred_time: '7:15_PM', special_requests: 'vegetarian_option' },
        dynamic_variables: {},
        environment: 'staging',
        created_at: '2024-01-17T16:30:00Z',
        call_started_at: '2024-01-17T16:30:00Z',
        call_ended_at: '2024-01-17T16:33:45Z',
        duration_seconds: 225,
        recording_url: 'https://demo-recordings.com/call_010.mp3',
        avg_latency: 0.5,
        transcription_metrics: { accuracy: 0.97 },
        total_stt_cost: 0.05,
        total_tts_cost: 0.08,
        total_llm_cost: 0.12
      },
      // Additional failed/timeout calls for realistic metrics
      {
        id: 'call_011',
        call_id: 'call_demo_011',
        agent_id: 'agent_001',
        customer_number: '+1-555-0111',
        call_ended_reason: 'timeout',
        transcript_type: 'partial',
        transcript_json: {
          conversation: [
            { speaker: 'agent', text: 'Hello, this is customer support. How can I help you today?' }
          ]
        },
        metadata: { customer_satisfaction: null, issue_resolved: false },
        dynamic_variables: {},
        environment: 'production',
        created_at: '2024-01-17T12:00:00Z',
        call_started_at: '2024-01-17T12:00:00Z',
        call_ended_at: '2024-01-17T12:00:30Z',
        duration_seconds: 30,
        recording_url: 'https://demo-recordings.com/call_011.mp3',
        avg_latency: 1.2,
        transcription_metrics: { accuracy: 0.85 },
        total_stt_cost: 0.01,
        total_tts_cost: 0.02,
        total_llm_cost: 0.03
      },
      {
        id: 'call_012',
        call_id: 'call_demo_012',
        agent_id: 'agent_003',
        customer_number: '+1-555-0112',
        call_ended_reason: 'busy',
        transcript_type: 'none',
        transcript_json: { conversation: [] },
        metadata: {},
        dynamic_variables: {},
        environment: 'dev',
        created_at: '2024-01-17T14:30:00Z',
        call_started_at: '2024-01-17T14:30:00Z',
        call_ended_at: '2024-01-17T14:30:05Z',
        duration_seconds: 5,
        recording_url: '',
        avg_latency: 0,
        transcription_metrics: { accuracy: 0 },
        total_stt_cost: 0,
        total_tts_cost: 0,
        total_llm_cost: 0
      }
    ]

    // Initialize detailed transcript logs with metrics
    this.transcriptLogs = [
      // Call 1 - Customer Support (agent_001)
      {
        id: 'transcript_001_01',
        session_id: 'call_001',
        turn_id: '1',
        user_transcript: 'Hi, I need help with my account',
        agent_response: 'I\'d be happy to help you with your account. What specific issue are you experiencing?',
        stt_metrics: { duration: 0.8, confidence: 0.95 },
        llm_metrics: { ttft: 1.2, tokens_per_second: 12.5, total_tokens: 45 },
        tts_metrics: { ttfb: 0.3, audio_duration: 3.2, synthesis_time: 0.5 },
        eou_metrics: { end_of_utterance_delay: 0.2, confidence: 0.92 },
        lesson_day: 1,
        created_at: '2024-01-16T09:30:00Z',
        unix_timestamp: 1705396200,
        phone_number: '+1-555-0101',
        call_duration: 225,
        call_success: true,
        lesson_completed: true
      },
      {
        id: 'transcript_001_02',
        session_id: 'call_001',
        turn_id: '2',
        user_transcript: 'I can\'t log into my account',
        agent_response: 'I understand. Let me help you reset your password.',
        stt_metrics: { duration: 0.7, confidence: 0.97 },
        llm_metrics: { ttft: 0.9, tokens_per_second: 14.2, total_tokens: 32 },
        tts_metrics: { ttfb: 0.25, audio_duration: 2.1, synthesis_time: 0.4 },
        eou_metrics: { end_of_utterance_delay: 0.15, confidence: 0.94 },
        lesson_day: 1,
        created_at: '2024-01-16T09:30:30Z',
        unix_timestamp: 1705396230,
        phone_number: '+1-555-0101',
        call_duration: 225,
        call_success: true,
        lesson_completed: true
      },
      
      // Call 2 - Customer Support (agent_001)
      {
        id: 'transcript_002_01',
        session_id: 'call_002',
        turn_id: '1',
        user_transcript: 'I want to cancel my subscription',
        agent_response: 'I\'m sorry to hear you want to cancel. Can I ask what prompted this decision?',
        stt_metrics: { duration: 0.9, confidence: 0.93 },
        llm_metrics: { ttft: 1.1, tokens_per_second: 11.8, total_tokens: 52 },
        tts_metrics: { ttfb: 0.35, audio_duration: 4.1, synthesis_time: 0.6 },
        eou_metrics: { end_of_utterance_delay: 0.25, confidence: 0.89 },
        lesson_day: 1,
        created_at: '2024-01-16T10:15:00Z',
        unix_timestamp: 1705398900,
        phone_number: '+1-555-0102',
        call_duration: 390,
        call_success: true,
        lesson_completed: true
      },
      {
        id: 'transcript_002_02',
        session_id: 'call_002',
        turn_id: '2',
        user_transcript: 'The service is too expensive',
        agent_response: 'I understand. Let me see if we have any promotions that might work better for you.',
        stt_metrics: { duration: 0.6, confidence: 0.96 },
        llm_metrics: { ttft: 1.3, tokens_per_second: 13.1, total_tokens: 48 },
        tts_metrics: { ttfb: 0.4, audio_duration: 3.8, synthesis_time: 0.55 },
        eou_metrics: { end_of_utterance_delay: 0.18, confidence: 0.91 },
        lesson_day: 1,
        created_at: '2024-01-16T10:15:45Z',
        unix_timestamp: 1705398945,
        phone_number: '+1-555-0102',
        call_duration: 390,
        call_success: true,
        lesson_completed: true
      },

      // Call 4 - Sales (agent_003)
      {
        id: 'transcript_004_01',
        session_id: 'call_004',
        turn_id: '1',
        user_transcript: 'Sure, what kind of CRM?',
        agent_response: 'Hi, I\'m calling about our new CRM solution. Do you have a few minutes?',
        stt_metrics: { duration: 0.5, confidence: 0.98 },
        llm_metrics: { ttft: 0.8, tokens_per_second: 15.2, total_tokens: 38 },
        tts_metrics: { ttfb: 0.2, audio_duration: 2.8, synthesis_time: 0.35 },
        eou_metrics: { end_of_utterance_delay: 0.12, confidence: 0.95 },
        lesson_day: 1,
        created_at: '2024-01-16T14:00:00Z',
        unix_timestamp: 1705413600,
        phone_number: '+1-555-0104',
        call_duration: 320,
        call_success: true,
        lesson_completed: true
      },
      {
        id: 'transcript_004_02',
        session_id: 'call_004',
        turn_id: '2',
        user_transcript: 'That sounds interesting. Can you send me more information?',
        agent_response: 'It\'s designed specifically for small businesses to manage customer relationships more effectively.',
        stt_metrics: { duration: 0.9, confidence: 0.94 },
        llm_metrics: { ttft: 1.0, tokens_per_second: 13.8, total_tokens: 55 },
        tts_metrics: { ttfb: 0.3, audio_duration: 4.2, synthesis_time: 0.5 },
        eou_metrics: { end_of_utterance_delay: 0.22, confidence: 0.88 },
        lesson_day: 1,
        created_at: '2024-01-16T14:01:30Z',
        unix_timestamp: 1705413690,
        phone_number: '+1-555-0104',
        call_duration: 320,
        call_success: true,
        lesson_completed: true
      },

      // Call 6 - Healthcare (agent_004)
      {
        id: 'transcript_006_01',
        session_id: 'call_006',
        turn_id: '1',
        user_transcript: 'I need to schedule an appointment with Dr. Smith',
        agent_response: 'I\'d be happy to help you schedule that. What type of appointment do you need?',
        stt_metrics: { duration: 1.1, confidence: 0.96 },
        llm_metrics: { ttft: 0.7, tokens_per_second: 14.5, total_tokens: 42 },
        tts_metrics: { ttfb: 0.25, audio_duration: 3.5, synthesis_time: 0.4 },
        eou_metrics: { end_of_utterance_delay: 0.18, confidence: 0.93 },
        lesson_day: 1,
        created_at: '2024-01-16T13:15:00Z',
        unix_timestamp: 1705410900,
        phone_number: '+1-555-0106',
        call_duration: 195,
        call_success: true,
        lesson_completed: true
      },
      {
        id: 'transcript_006_02',
        session_id: 'call_006',
        turn_id: '2',
        user_transcript: 'It\'s for a regular checkup',
        agent_response: 'Perfect. Dr. Smith has availability next Tuesday at 2 PM or Thursday at 10 AM. Which works better for you?',
        stt_metrics: { duration: 0.6, confidence: 0.98 },
        llm_metrics: { ttft: 1.2, tokens_per_second: 12.3, total_tokens: 58 },
        tts_metrics: { ttfb: 0.35, audio_duration: 4.8, synthesis_time: 0.6 },
        eou_metrics: { end_of_utterance_delay: 0.15, confidence: 0.96 },
        lesson_day: 1,
        created_at: '2024-01-16T13:15:30Z',
        unix_timestamp: 1705410930,
        phone_number: '+1-555-0106',
        call_duration: 195,
        call_success: true,
        lesson_completed: true
      },

      // Call 7 - Emergency Healthcare (agent_010)
      {
        id: 'transcript_007_01',
        session_id: 'call_007',
        turn_id: '1',
        user_transcript: 'I need an urgent appointment. I\'ve been having chest pains.',
        agent_response: 'I understand this is urgent. How long have you been experiencing chest pains?',
        stt_metrics: { duration: 1.3, confidence: 0.97 },
        llm_metrics: { ttft: 0.5, tokens_per_second: 16.2, total_tokens: 44 },
        tts_metrics: { ttfb: 0.15, audio_duration: 3.1, synthesis_time: 0.3 },
        eou_metrics: { end_of_utterance_delay: 0.1, confidence: 0.98 },
        lesson_day: 1,
        created_at: '2024-01-16T15:45:00Z',
        unix_timestamp: 1705420500,
        phone_number: '+1-555-0107',
        call_duration: 135,
        call_success: true,
        lesson_completed: true
      },
      {
        id: 'transcript_007_02',
        session_id: 'call_007',
        turn_id: '2',
        user_transcript: 'Started about 2 hours ago',
        agent_response: 'I\'m going to connect you with our emergency triage nurse immediately and also schedule you for the earliest available slot today.',
        stt_metrics: { duration: 0.7, confidence: 0.99 },
        llm_metrics: { ttft: 0.6, tokens_per_second: 15.8, total_tokens: 68 },
        tts_metrics: { ttfb: 0.2, audio_duration: 5.2, synthesis_time: 0.45 },
        eou_metrics: { end_of_utterance_delay: 0.08, confidence: 0.99 },
        lesson_day: 1,
        created_at: '2024-01-16T15:45:20Z',
        unix_timestamp: 1705420520,
        phone_number: '+1-555-0107',
        call_duration: 135,
        call_success: true,
        lesson_completed: true
      },

      // Call 10 - Restaurant (agent_007)
      {
        id: 'transcript_010_01',
        session_id: 'call_010',
        turn_id: '1',
        user_transcript: 'I\'d like to make a reservation for tonight',
        agent_response: 'I\'d be happy to help! How many people will be dining with us?',
        stt_metrics: { duration: 0.8, confidence: 0.96 },
        llm_metrics: { ttft: 0.9, tokens_per_second: 14.1, total_tokens: 35 },
        tts_metrics: { ttfb: 0.25, audio_duration: 2.7, synthesis_time: 0.4 },
        eou_metrics: { end_of_utterance_delay: 0.16, confidence: 0.94 },
        lesson_day: 1,
        created_at: '2024-01-17T16:30:00Z',
        unix_timestamp: 1705510200,
        phone_number: '+1-555-0110',
        call_duration: 225,
        call_success: true,
        lesson_completed: true
      },
      {
        id: 'transcript_010_02',
        session_id: 'call_010',
        turn_id: '2',
        user_transcript: 'Table for 4, around 7 PM if possible',
        agent_response: 'Perfect! I have availability at 7:15 PM. Any special dietary requirements?',
        stt_metrics: { duration: 0.9, confidence: 0.95 },
        llm_metrics: { ttft: 0.8, tokens_per_second: 13.9, total_tokens: 41 },
        tts_metrics: { ttfb: 0.3, audio_duration: 3.2, synthesis_time: 0.45 },
        eou_metrics: { end_of_utterance_delay: 0.19, confidence: 0.92 },
        lesson_day: 1,
        created_at: '2024-01-17T16:30:45Z',
        unix_timestamp: 1705510245,
        phone_number: '+1-555-0110',
        call_duration: 225,
        call_success: true,
        lesson_completed: true
      },
      {
        id: 'transcript_010_03',
        session_id: 'call_010',
        turn_id: '3',
        user_transcript: 'One person is vegetarian',
        agent_response: 'Noted! Your reservation is confirmed for 4 people at 7:15 PM with vegetarian options.',
        stt_metrics: { duration: 0.5, confidence: 0.98 },
        llm_metrics: { ttft: 1.1, tokens_per_second: 12.7, total_tokens: 49 },
        tts_metrics: { ttfb: 0.35, audio_duration: 4.1, synthesis_time: 0.5 },
        eou_metrics: { end_of_utterance_delay: 0.14, confidence: 0.95 },
        lesson_day: 1,
        created_at: '2024-01-17T16:31:15Z',
        unix_timestamp: 1705510275,
        phone_number: '+1-555-0110',
        call_duration: 225,
        call_success: true,
        lesson_completed: true
      }
    ]

    this.users = [
      {
        id: 'user_001',
        clerk_id: 'user_demo_123',
        email: 'demo@example.com',
        first_name: 'Demo',
        last_name: 'User',
        profile_image_url: 'https://via.placeholder.com/150',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_active: true
      }
    ]

    // Initialize custom overview metrics
    this.customOverviewMetrics = [
      {
        id: 'metric_avg_duration',
        name: 'Avg Duration',
        value: 4.8,
        previousValue: 4.2,
        change: 14.3,
        changeType: 'increase',
        unit: 'minutes',
        suffix: 'm',
        icon: 'Clock',
        color: 'indigo',
        description: 'Average conversation duration per call',
        agentId: 'agent_001', // Sales Follow-up Agent
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      },
      {
        id: 'metric_cost_per_call',
        name: 'Cost Per Call',
        value: 0.15,
        previousValue: 0.18,
        change: -16.7,
        changeType: 'decrease',
        unit: 'currency',
        prefix: '₹',
        icon: 'Calculator',
        color: 'orange',
        description: 'Average cost per individual call',
        agentId: 'agent_001',
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      },
      {
        id: 'metric_daily_volume',
        name: 'Daily Volume',
        value: 45,
        previousValue: 40,
        change: 12.5,
        changeType: 'increase',
        unit: 'count',
        suffix: '/day',
        icon: 'TrendUp',
        color: 'cyan',
        description: 'Average number of calls per day',
        agentId: 'agent_001',
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      },
      {
        id: 'metric_satisfaction',
        name: 'Satisfaction',
        value: 87.2,
        previousValue: 84.1,
        change: 3.7,
        changeType: 'increase',
        unit: 'percentage',
        suffix: '%',
        icon: 'Target',
        color: 'yellow',
        description: 'Customer satisfaction rating',
        agentId: 'agent_001',
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      },
      {
        id: 'metric_conversion_rate',
        name: 'Conversion',
        value: 15.8,
        previousValue: 12.3,
        change: 28.5,
        changeType: 'increase',
        unit: 'percentage',
        suffix: '%',
        icon: 'Percent',
        color: 'green',
        description: 'Lead to sale conversion rate',
        agentId: 'agent_001',
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      },
      {
        id: 'metric_peak_volume',
        name: 'Peak Volume',
        value: 78,
        previousValue: 65,
        change: 20.0,
        changeType: 'increase',
        unit: 'count',
        suffix: ' calls',
        icon: 'Activity',
        color: 'pink',
        description: 'Highest daily call volume',
        agentId: 'agent_001',
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      },
      // Metrics for Support Agent
      {
        id: 'metric_resolution_rate',
        name: 'Resolution',
        value: 89.4,
        previousValue: 86.7,
        change: 3.1,
        changeType: 'increase',
        unit: 'percentage',
        suffix: '%',
        icon: 'CheckCircle',
        color: 'teal',
        description: 'Issue resolution success rate',
        agentId: 'agent_002',
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      },
      {
        id: 'metric_support_satisfaction',
        name: 'Satisfaction',
        value: 91.7,
        previousValue: 88.2,
        change: 4.0,
        changeType: 'increase',
        unit: 'percentage',
        suffix: '%',
        icon: 'Target',
        color: 'yellow',
        description: 'Customer satisfaction for support',
        agentId: 'agent_002',
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      }
    ]
  }

  // Project operations
  getProjects(userClerkId?: string): MockProject[] {
    // For demo purposes, return all projects regardless of user ID
    // In a real app, you'd filter by userClerkId
    return this.projects.filter(p => p.is_active)
  }

  getProjectById(id: string): MockProject | null {
    return this.projects.find(p => p.id === id && p.is_active) || null
  }

  createProject(data: Partial<MockProject>): MockProject {
    const newProject: MockProject = {
      id: `proj_${Date.now()}`,
      name: data.name || 'New Project',
      description: data.description || '',
      environment: data.environment || 'dev',
      owner_clerk_id: data.owner_clerk_id || 'user_demo_123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      user_role: 'owner',
      api_token: `pype_demo_${Date.now()}`
    }
    this.projects.push(newProject)
    return newProject
  }

  updateProject(id: string, data: Partial<MockProject>): MockProject | null {
    const index = this.projects.findIndex(p => p.id === id)
    if (index === -1) return null
    
    this.projects[index] = {
      ...this.projects[index],
      ...data,
      updated_at: new Date().toISOString()
    }
    return this.projects[index]
  }

  deleteProject(id: string): boolean {
    const index = this.projects.findIndex(p => p.id === id)
    if (index === -1) return false
    
    this.projects[index].is_active = false
    this.projects[index].updated_at = new Date().toISOString()
    return true
  }

  // Agent operations
  getAgents(projectId?: string): MockAgent[] {
    if (projectId) {
      return this.agents.filter(a => a.project_id === projectId && a.is_active)
    }
    return this.agents.filter(a => a.is_active)
  }

  getAgentById(id: string): MockAgent | null {
    return this.agents.find(a => a.id === id && a.is_active) || null
  }

  createAgent(data: Partial<MockAgent>): MockAgent {
    const newAgent: MockAgent = {
      id: `agent_${Date.now()}`,
      name: data.name || 'New Agent',
      agent_type: data.agent_type || 'inbound',
      configuration: data.configuration || {},
      project_id: data.project_id || '',
      environment: data.environment || 'dev',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      field_extractor: data.field_extractor || false
    }
    this.agents.push(newAgent)
    return newAgent
  }

  updateAgent(id: string, data: Partial<MockAgent>): MockAgent | null {
    const index = this.agents.findIndex(a => a.id === id)
    if (index === -1) return null
    
    this.agents[index] = {
      ...this.agents[index],
      ...data,
      updated_at: new Date().toISOString()
    }
    return this.agents[index]
  }

  deleteAgent(id: string): boolean {
    const index = this.agents.findIndex(a => a.id === id)
    if (index === -1) return false
    
    this.agents[index].is_active = false
    this.agents[index].updated_at = new Date().toISOString()
    return true
  }

  // Call log operations
  getCallLogs(agentId?: string, limit: number = 100): MockCallLog[] {
    // Defensive check - ensure callLogs is initialized
    if (!this.callLogs) {
      console.warn('callLogs not initialized, returning empty array')
      return []
    }
    
    console.log(`📞 getCallLogs called with agentId: ${agentId}, total callLogs: ${this.callLogs.length}`)
    
    let logs = this.callLogs
    if (agentId) {
      logs = logs.filter(c => c.agent_id === agentId)
      console.log(`📞 Filtered to ${logs.length} calls for agent ${agentId}`)
    }
    
    const result = logs.slice(0, limit).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    
    console.log(`📞 Returning ${result.length} call logs`)
    return result
  }

  getTranscriptLogs(sessionId?: string): MockTranscriptLog[] {
    if (sessionId) {
      return this.transcriptLogs
        .filter(log => log.session_id === sessionId)
        .sort((a, b) => a.unix_timestamp - b.unix_timestamp)
    }
    return this.transcriptLogs.sort((a, b) => b.unix_timestamp - a.unix_timestamp)
  }

  createCallLog(data: Partial<MockCallLog>): MockCallLog {
    const newCallLog: MockCallLog = {
      id: `call_${Date.now()}`,
      call_id: data.call_id || `call_demo_${Date.now()}`,
      agent_id: data.agent_id || '',
      customer_number: data.customer_number || '+1-555-0000',
      call_ended_reason: data.call_ended_reason || 'completed',
      transcript_type: 'final',
      transcript_json: data.transcript_json || {},
      metadata: data.metadata || {},
      dynamic_variables: data.dynamic_variables || {},
      environment: data.environment || 'dev',
      created_at: new Date().toISOString(),
      call_started_at: data.call_started_at || new Date().toISOString(),
      call_ended_at: data.call_ended_at || new Date().toISOString(),
      duration_seconds: data.duration_seconds || 0,
      recording_url: data.recording_url || '',
      avg_latency: data.avg_latency || 0.5,
      transcription_metrics: data.transcription_metrics || {},
      total_stt_cost: data.total_stt_cost || 0,
      total_tts_cost: data.total_tts_cost || 0,
      total_llm_cost: data.total_llm_cost || 0
    }
    this.callLogs.push(newCallLog)
    return newCallLog
  }

  // User operations
  getUserByClerkId(clerkId: string): MockUser | null {
    // For demo purposes, return a mock user for any clerk ID
    const existingUser = this.users.find(u => u.clerk_id === clerkId && u.is_active)
    if (existingUser) {
      return existingUser
    }
    
    // Return a default mock user for any clerk ID
    return {
      id: 'user_001',
      clerk_id: clerkId,
      email: 'demo@example.com',
      first_name: 'Demo',
      last_name: 'User',
      profile_image_url: 'https://via.placeholder.com/150',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    }
  }

  // Return empty analytics structure
  private getEmptyAnalytics() {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      totalMinutes: 0,
      totalDuration: 0,
      totalCost: 0,
      averageLatency: 0,
      successRate: 0,
      dailyData: [],
      hourlyDistribution: [],
      weeklyTrends: [],
      responseTimeDistribution: [],
      satisfactionScores: [],
      conversionMetrics: []
    }
  }

  // Enhanced Analytics operations with rich historical data
  getAnalytics(agentId?: string, dateFrom?: string, dateTo?: string) {
    console.log(`📊 getAnalytics called with agentId: ${agentId}, callLogs available: ${this.callLogs?.length || 0}`)
    
    // CRITICAL FIX: If callLogs is empty but localStorage has data, reload from localStorage
    if ((!this.callLogs || this.callLogs.length === 0) && typeof window !== 'undefined') {
      console.log('🔄 getAnalytics: callLogs empty, attempting to reload from localStorage')
      try {
        const savedCallLogs = localStorage.getItem('mockData_callLogs')
        if (savedCallLogs) {
          const parsedLogs = JSON.parse(savedCallLogs)
          if (parsedLogs && parsedLogs.length > 0) {
            console.log(`🔄 getAnalytics: Reloading ${parsedLogs.length} call logs from localStorage`)
            this.callLogs = parsedLogs
            
            // Also reload other data to keep consistency
            const savedAgents = localStorage.getItem('mockData_agents')
            const savedProjects = localStorage.getItem('mockData_projects')
            if (savedAgents) this.agents = JSON.parse(savedAgents)
            if (savedProjects) this.projects = JSON.parse(savedProjects)
          }
        }
      } catch (e) {
        console.error('🔄 getAnalytics: Failed to reload from localStorage:', e)
      }
    }
    
    console.log(`📊 getAnalytics: After reload check, callLogs available: ${this.callLogs?.length || 0}`)
    
    // Get agent info for context-specific analytics
    const agent = agentId ? this.getAgentById(agentId) : null
    console.log(`📊 Found agent:`, agent ? agent.name : 'No agent found')
    
    // Generate rich analytics data based on agent type and use case
    return this.generateEnhancedAnalytics(agent, dateFrom, dateTo)
  }

  private generateEnhancedAnalytics(agent: MockAgent | null, dateFrom?: string, dateTo?: string) {
    // Defensive check - ensure callLogs is initialized
    if (!this.callLogs) {
      console.warn('📊 generateEnhancedAnalytics: callLogs not initialized, returning empty analytics')
      return this.getEmptyAnalytics()
    }
    
    console.log(`📊 generateEnhancedAnalytics: Processing ${this.callLogs.length} total call logs`)
    
    // Base metrics from actual call logs
    let logs = this.callLogs
    if (agent) {
      logs = logs.filter(c => c.agent_id === agent.id)
      console.log(`📊 generateEnhancedAnalytics: Filtered to ${logs.length} calls for agent ${agent.id}`)
    }
    
    const totalCalls = logs.length
    const completedCalls = logs.filter(c => c.call_ended_reason === 'completed').length
    const totalDuration = logs.reduce((sum, c) => sum + c.duration_seconds, 0)
    const totalCost = logs.reduce((sum, c) => sum + c.total_stt_cost + c.total_tts_cost + c.total_llm_cost, 0)
    const avgLatency = logs.reduce((sum, c) => sum + c.avg_latency, 0) / logs.length || 0
    
    console.log(`📊 generateEnhancedAnalytics: Calculated metrics - calls: ${totalCalls}, duration: ${totalDuration}, cost: ${totalCost}`)

    // Generate enhanced metrics based on agent type
    const agentType = agent?.agent_type || 'general'
    const agentName = agent?.name || 'All Agents'
    
    // Generate historical data for charts (30 days of simulated data)
    const dailyData = this.generateDailyMetrics(agentType, 30)
    const hourlyData = this.generateHourlyMetrics(agentType, 24)
    const weeklyData = this.generateWeeklyMetrics(agentType, 12)
    
    // Agent-specific KPIs
    const agentSpecificMetrics = this.generateAgentSpecificKPIs(agentType, agent)
    
    return {
      // Core metrics (matching Overview component expectations)
      totalCalls: Math.max(totalCalls, agentSpecificMetrics.minCalls),
      successfulCalls: Math.max(completedCalls, Math.floor(agentSpecificMetrics.minCalls * 0.85)),
      successRate: agentSpecificMetrics.successRate,
      totalDuration: Math.max(totalDuration, agentSpecificMetrics.totalDuration),
      totalMinutes: Math.round(Math.max(totalDuration, agentSpecificMetrics.totalDuration) / 60),
      avgDuration: agentSpecificMetrics.avgDuration,
      totalCost: Math.max(totalCost, agentSpecificMetrics.totalCost),
      averageLatency: agentSpecificMetrics.avgLatency,
      
      // Chart data (matching Overview component expectations)
      dailyData: dailyData,
      hourlyDistribution: hourlyData,
      weeklyTrends: weeklyData,
      
      // Performance metrics
      responseTimeDistribution: this.generateResponseTimeDistribution(agentType),
      satisfactionScores: this.generateSatisfactionData(agentType),
      conversionMetrics: this.generateConversionMetrics(agentType),
      
      // Agent-specific insights
      agentType,
      agentName,
      primaryUseCase: agentSpecificMetrics.useCase,
      keyMetrics: agentSpecificMetrics.keyMetrics,
      
      // Trend indicators
      callVolumeGrowth: agentSpecificMetrics.growth.calls,
      costEfficiency: agentSpecificMetrics.growth.costPerCall,
      performanceImprovement: agentSpecificMetrics.growth.performance
    }
  }

  private generateAgentSpecificKPIs(agentType: string, agent: MockAgent | null) {
    const configs = {
      'inbound': {
        minCalls: 450,
        successRate: 94.2,
        avgDuration: 285,
        totalDuration: 128250, // 450 * 285
        totalCost: 67.50,
        avgLatency: 0.65,
        useCase: 'Customer Support',
        keyMetrics: ['Resolution Rate', 'Customer Satisfaction', 'First Call Resolution'],
        growth: { calls: 12.5, costPerCall: -8.3, performance: 5.7 }
      },
      'outbound': {
        minCalls: 320,
        successRate: 78.5,
        avgDuration: 195,
        totalDuration: 62400, // 320 * 195
        totalCost: 89.60,
        avgLatency: 0.55,
        useCase: 'Sales & Lead Generation',
        keyMetrics: ['Conversion Rate', 'Lead Quality', 'Call Connect Rate'],
        growth: { calls: 18.2, costPerCall: -12.1, performance: 9.4 }
      }
    }
    
    return configs[agentType as keyof typeof configs] || configs['inbound']
  }

  private generateDailyMetrics(agentType: string, days: number) {
    const data = []
    const baseVolume = agentType === 'outbound' ? 15 : 25
    
    for (let i = days; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      
      // Add realistic variance and trends
      const weekday = date.getDay()
      const weekdayMultiplier = [0.3, 1.0, 1.1, 1.2, 1.1, 0.8, 0.4][weekday] // Lower on weekends
      const randomVariance = 0.7 + Math.random() * 0.6
      const trendGrowth = 1 + (days - i) * 0.01 // Slight upward trend
      
      const calls = Math.round(baseVolume * weekdayMultiplier * randomVariance * trendGrowth)
      const successRate = Math.min(98, 75 + Math.random() * 20)
      const avgDuration = agentType === 'outbound' ? 180 + Math.random() * 120 : 240 + Math.random() * 180
      
      const totalDuration = Math.round(calls * avgDuration)
      data.push({
        date: date.toISOString().split('T')[0],
        calls,
        successful: Math.round(calls * successRate / 100),
        failed: calls - Math.round(calls * successRate / 100),
        duration: totalDuration,
        minutes: Math.round(totalDuration / 60), // Convert seconds to minutes for Usage Minutes chart
        cost: Math.round(calls * (0.15 + Math.random() * 0.1) * 100) / 100,
        avgLatency: 0.4 + Math.random() * 0.4,
        avg_latency: 0.4 + Math.random() * 0.4 // Also provide avg_latency for Response Performance chart
      })
    }
    
    return data
  }

  private generateHourlyMetrics(agentType: string, hours: number) {
    const data = []
    const peakHours = agentType === 'outbound' ? [10, 11, 14, 15, 16] : [9, 10, 11, 13, 14, 15, 16]
    
    for (let hour = 0; hour < hours; hour++) {
      const isPeakHour = peakHours.includes(hour)
      const baseVolume = isPeakHour ? 15 : 5
      const calls = Math.round(baseVolume * (0.5 + Math.random() * 1.0))
      
      data.push({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        calls,
        avgLatency: 0.3 + Math.random() * 0.5,
        successRate: 80 + Math.random() * 15
      })
    }
    
    return data
  }

  private generateWeeklyMetrics(agentType: string, weeks: number) {
    const data = []
    const baseWeeklyVolume = agentType === 'outbound' ? 120 : 180
    
    for (let i = weeks; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i * 7))
      
      const seasonalMultiplier = 0.8 + Math.sin((weeks - i) / weeks * Math.PI) * 0.3
      const calls = Math.round(baseWeeklyVolume * seasonalMultiplier * (0.8 + Math.random() * 0.4))
      
      data.push({
        week: `Week ${weeks - i + 1}`,
        calls,
        revenue: agentType === 'outbound' ? Math.round(calls * 45 * Math.random()) : 0,
        satisfaction: 3.8 + Math.random() * 1.0,
        efficiency: 75 + Math.random() * 20
      })
    }
    
    return data
  }

  private generateResponseTimeDistribution(agentType: string) {
    return [
      { range: '0-0.5s', count: Math.round(40 + Math.random() * 20), percentage: 35 },
      { range: '0.5-1s', count: Math.round(30 + Math.random() * 15), percentage: 28 },
      { range: '1-2s', count: Math.round(20 + Math.random() * 10), percentage: 22 },
      { range: '2-3s', count: Math.round(10 + Math.random() * 8), percentage: 10 },
      { range: '3s+', count: Math.round(5 + Math.random() * 5), percentage: 5 }
    ]
  }

  private generateSatisfactionData(agentType: string) {
    const baseScore = agentType === 'inbound' ? 4.2 : 3.8
    return {
      average: baseScore + (Math.random() - 0.5) * 0.4,
      distribution: [
        { rating: 5, count: Math.round(45 + Math.random() * 20) },
        { rating: 4, count: Math.round(35 + Math.random() * 15) },
        { rating: 3, count: Math.round(15 + Math.random() * 10) },
        { rating: 2, count: Math.round(3 + Math.random() * 5) },
        { rating: 1, count: Math.round(2 + Math.random() * 3) }
      ]
    }
  }

  private generateConversionMetrics(agentType: string) {
    if (agentType === 'outbound') {
      return {
        leadConversion: 15.2 + Math.random() * 8,
        appointmentSet: 32.1 + Math.random() * 12,
        followUpRequired: 45.3 + Math.random() * 15,
        qualified: 28.7 + Math.random() * 10
      }
    } else {
      return {
        issueResolved: 87.5 + Math.random() * 8,
        escalationRate: 8.2 + Math.random() * 4,
        firstCallResolution: 78.3 + Math.random() * 12,
        customerRetained: 94.1 + Math.random() * 4
      }
    }
  }

  // Custom Overview Metrics operations
  getCustomOverviewMetrics(agentId?: string): CustomOverviewMetric[] {
    // Defensive check - ensure customOverviewMetrics is initialized
    if (!this.customOverviewMetrics) {
      console.warn('customOverviewMetrics not initialized, returning empty array')
      return []
    }
    
    if (agentId) {
      return this.customOverviewMetrics.filter(m => m.agentId === agentId && m.isActive)
    }
    return this.customOverviewMetrics.filter(m => m.isActive)
  }

  createCustomOverviewMetric(data: Partial<CustomOverviewMetric>): CustomOverviewMetric {
    // Initialize customOverviewMetrics if not exists
    if (!this.customOverviewMetrics) {
      this.customOverviewMetrics = []
    }
    
    const newMetric: CustomOverviewMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: data.name || 'New Metric',
      value: data.value || 0,
      previousValue: data.previousValue,
      change: data.change,
      changeType: data.changeType || 'neutral',
      unit: data.unit || 'count',
      prefix: data.prefix,
      suffix: data.suffix,
      icon: data.icon || 'Target',
      color: data.color || 'blue',
      description: data.description || '',
      agentId: data.agentId,
      projectId: data.projectId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    this.customOverviewMetrics.push(newMetric)
    return newMetric
  }

  updateCustomOverviewMetric(id: string, data: Partial<CustomOverviewMetric>): CustomOverviewMetric | null {
    // Initialize customOverviewMetrics if not exists
    if (!this.customOverviewMetrics) {
      this.customOverviewMetrics = []
      return null
    }
    
    const index = this.customOverviewMetrics.findIndex(m => m.id === id)
    if (index === -1) return null

    this.customOverviewMetrics[index] = {
      ...this.customOverviewMetrics[index],
      ...data,
      id, // Prevent ID change
      updatedAt: new Date().toISOString()
    }

    return this.customOverviewMetrics[index]
  }

  deleteCustomOverviewMetric(id: string): boolean {
    // Initialize customOverviewMetrics if not exists
    if (!this.customOverviewMetrics) {
      this.customOverviewMetrics = []
      return false
    }
    
    const index = this.customOverviewMetrics.findIndex(m => m.id === id)
    if (index === -1) return false

    this.customOverviewMetrics[index].isActive = false
    this.customOverviewMetrics[index].updatedAt = new Date().toISOString()
    return true
  }

  // Bulk data replacement methods for Magic Editor
  replaceAllProjects(newProjects: MockProject[]): boolean {
    try {
      this.projects = newProjects
      this.saveDataToStorage()
      this.emit('projects:changed', this.projects)
      this.emit('data:changed', { type: 'projects', data: this.projects })
      console.log('🔄 Projects data updated and broadcasted')
      return true
    } catch (error) {
      console.error('Error replacing projects:', error)
      return false
    }
  }

  replaceAllAgents(newAgents: MockAgent[]): boolean {
    try {
      this.agents = newAgents
      this.saveDataToStorage()
      this.emit('agents:changed', this.agents)
      this.emit('data:changed', { type: 'agents', data: this.agents })
      console.log('🔄 Agents data updated and broadcasted')
      return true
    } catch (error) {
      console.error('Error replacing agents:', error)
      return false
    }
  }

  replaceAllCallLogs(newCallLogs: MockCallLog[]): boolean {
    try {
      this.callLogs = newCallLogs
      this.saveDataToStorage()
      this.emit('callLogs:changed', this.callLogs)
      this.emit('data:changed', { type: 'callLogs', data: this.callLogs })
      console.log('🔄 Call logs data updated and broadcasted')
      return true
    } catch (error) {
      console.error('Error replacing call logs:', error)
      return false
    }
  }

  replaceAllCustomOverviewMetrics(newMetrics: CustomOverviewMetric[]): boolean {
    try {
      this.customOverviewMetrics = newMetrics || []
      this.saveDataToStorage()
      this.emit('metrics:changed', this.customOverviewMetrics)
      this.emit('data:changed', { type: 'metrics', data: this.customOverviewMetrics })
      console.log('🔄 Custom metrics data updated and broadcasted')
      return true
    } catch (error) {
      console.error('Error replacing custom metrics:', error)
      return false
    }
  }

  replaceAllTranscriptLogs(newTranscriptLogs: MockTranscriptLog[]): boolean {
    try {
      this.transcriptLogs = newTranscriptLogs
      this.saveDataToStorage()
      this.emit('transcriptLogs:changed', this.transcriptLogs)
      this.emit('data:changed', { type: 'transcriptLogs', data: this.transcriptLogs })
      console.log('🔄 Transcript logs data updated and broadcasted')
      return true
    } catch (error) {
      console.error('Error replacing transcript logs:', error)
      return false
    }
  }

  // Method to reset all data to original dummy data
  resetToDefaults(): boolean {
    try {
      this.initializeDummyData()
      this.saveDataToStorage()
      
      // Emit events for all data types
      this.emit('projects:changed', this.projects)
      this.emit('agents:changed', this.agents)
      this.emit('callLogs:changed', this.callLogs)
      this.emit('metrics:changed', this.customOverviewMetrics || [])
      this.emit('transcriptLogs:changed', this.transcriptLogs)
      this.emit('data:changed', { type: 'all', data: 'reset' })
      
      console.log('🔄 All data reset to defaults and broadcasted')
      return true
    } catch (error) {
      console.error('Error resetting to defaults:', error)
      return false
    }
  }

  // Method to clear all localStorage data
  clearStoredData(): boolean {
    try {
      if (typeof window === 'undefined') return false
      
      localStorage.removeItem('mockData_projects')
      localStorage.removeItem('mockData_agents')
      localStorage.removeItem('mockData_callLogs')
      localStorage.removeItem('mockData_metrics')
      localStorage.removeItem('mockData_transcriptLogs')
      localStorage.removeItem('mockData_users')
      
      console.log('🗑️ Cleared all stored data')
      return true
    } catch (error) {
      console.error('Error clearing stored data:', error)
      return false
    }
  }
}

// Singleton instance
const mockDataStore = new MockDataStore()

// Export the mock data service
export const MockDataService = {
  // Projects
  getProjects: (userClerkId?: string) => mockDataStore.getProjects(userClerkId),
  getProjectById: (id: string) => mockDataStore.getProjectById(id),
  createProject: (data: Partial<MockProject>) => mockDataStore.createProject(data),
  updateProject: (id: string, data: Partial<MockProject>) => mockDataStore.updateProject(id, data),
  deleteProject: (id: string) => mockDataStore.deleteProject(id),

  // Agents
  getAgents: (projectId?: string) => mockDataStore.getAgents(projectId),
  getAgentById: (id: string) => mockDataStore.getAgentById(id),
  createAgent: (data: Partial<MockAgent>) => mockDataStore.createAgent(data),
  updateAgent: (id: string, data: Partial<MockAgent>) => mockDataStore.updateAgent(id, data),
  deleteAgent: (id: string) => mockDataStore.deleteAgent(id),

  // Call Logs
  getCallLogs: (agentId?: string, limit?: number) => mockDataStore.getCallLogs(agentId, limit),
  createCallLog: (data: Partial<MockCallLog>) => mockDataStore.createCallLog(data),

  // Transcript Logs
  getTranscriptLogs: (sessionId?: string) => mockDataStore.getTranscriptLogs(sessionId),

  // Users
  getUserByClerkId: (clerkId: string) => mockDataStore.getUserByClerkId(clerkId),

  // Analytics
  getAnalytics: (agentId?: string, dateFrom?: string, dateTo?: string) => 
    mockDataStore.getAnalytics(agentId, dateFrom, dateTo),

  // Custom Overview Metrics
  getCustomOverviewMetrics: (agentId?: string) => mockDataStore.getCustomOverviewMetrics(agentId),
  createCustomOverviewMetric: (data: Partial<CustomOverviewMetric>) => mockDataStore.createCustomOverviewMetric(data),
  updateCustomOverviewMetric: (id: string, data: Partial<CustomOverviewMetric>) => mockDataStore.updateCustomOverviewMetric(id, data),
  deleteCustomOverviewMetric: (id: string) => mockDataStore.deleteCustomOverviewMetric(id),

  // Bulk data replacement for Magic Editor
  replaceAllProjects: (newProjects: MockProject[]) => mockDataStore.replaceAllProjects(newProjects),
  replaceAllAgents: (newAgents: MockAgent[]) => mockDataStore.replaceAllAgents(newAgents),
  replaceAllCallLogs: (newCallLogs: MockCallLog[]) => mockDataStore.replaceAllCallLogs(newCallLogs),
  replaceAllCustomOverviewMetrics: (newMetrics: CustomOverviewMetric[]) => mockDataStore.replaceAllCustomOverviewMetrics(newMetrics),
  replaceAllTranscriptLogs: (newTranscriptLogs: MockTranscriptLog[]) => mockDataStore.replaceAllTranscriptLogs(newTranscriptLogs),

  // Data management utilities
  resetToDefaults: () => mockDataStore.resetToDefaults(),
  clearStoredData: () => mockDataStore.clearStoredData(),
  syncWithAPI: () => mockDataStore.syncWithAPI(),

  // Event system for real-time updates
  on: (event: string, callback: (data: any) => void) => mockDataStore.on(event, callback),
  off: (event: string, callback: (data: any) => void) => mockDataStore.off(event, callback)
}

export default MockDataService

// Make MockDataService available globally in browser for console access
if (typeof window !== 'undefined') {
  (window as any).MockDataService = MockDataService
  
  // Listen for data refresh events
  window.addEventListener('dataRefreshed', (event: any) => {
    console.log('🔄 MockDataService: Received data refresh event')
    const freshData = event.detail
    
    // Update the singleton instance with fresh data
    if (freshData.projects) mockDataStore.projects = freshData.projects
    if (freshData.agents) mockDataStore.agents = freshData.agents  
    if (freshData.callLogs) mockDataStore.callLogs = freshData.callLogs
    if (freshData.users) mockDataStore.users = freshData.users
    if (freshData.customOverviewMetrics) mockDataStore.customOverviewMetrics = freshData.customOverviewMetrics
    
    // Emit data change events to notify components
    mockDataStore.emit('data:changed', { type: 'refresh', source: 'api' })
    mockDataStore.emit('callLogs:changed', mockDataStore.callLogs)
    
    console.log('✅ MockDataService: Updated with fresh data')
  })
}
