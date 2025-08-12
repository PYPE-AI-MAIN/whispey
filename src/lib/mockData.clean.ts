// Mock Data Service - Direct API Integration (No localStorage)
// Perfect for demos - data persists via JSON files through API

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

export interface CustomOverviewMetric {
  id: string
  name: string
  value: number | string
  type: 'number' | 'percentage' | 'currency' | 'duration'
  description?: string
  agentId?: string
  projectId?: string
  createdAt: string
  updatedAt: string
}

// Mock Data Storage (Direct API Integration)
class MockDataStore {
  private projects: MockProject[] = []
  private agents: MockAgent[] = []
  private callLogs: MockCallLog[] = []
  private customOverviewMetrics: CustomOverviewMetric[] = []
  private transcriptLogs: any[] = []
  private users: any[] = []
  private listeners: Map<string, ((data: any) => void)[]> = new Map()
  private isLoading = false

  constructor() {
    if (typeof window !== 'undefined') {
      // Initialize with dummy data first for immediate UI response
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

  // Sync with JSON API - always fetch fresh data
  async syncWithAPI() {
    if (this.isLoading) return // Prevent concurrent syncs
    
    try {
      this.isLoading = true
      if (typeof window === 'undefined') return // Skip on server-side

      console.log('🔄 Syncing with API...')
      const response = await fetch('/api/data?type=current')
      if (!response.ok) throw new Error(`API response: ${response.status}`)
      
      const apiData = await response.json()
      console.log('📦 Received API data:', {
        projects: apiData.projects?.length || 0,
        agents: apiData.agents?.length || 0,
        callLogs: apiData.callLogs?.length || 0,
        customOverviewMetrics: apiData.customOverviewMetrics?.length || 0
      })
      
      // Update internal data
      if (apiData.projects) this.projects = apiData.projects
      if (apiData.agents) this.agents = apiData.agents
      if (apiData.callLogs) this.callLogs = apiData.callLogs
      if (apiData.customOverviewMetrics) this.customOverviewMetrics = apiData.customOverviewMetrics
      if (apiData.transcriptLogs) this.transcriptLogs = apiData.transcriptLogs
      if (apiData.users) this.users = apiData.users
      
      // Emit events to notify components of data changes
      this.emit('data:changed', { type: 'sync', source: 'api' })
      
      console.log('✅ Synced data with JSON API')
    } catch (error) {
      console.warn('❌ Failed to sync with API:', error)
    } finally {
      this.isLoading = false
    }
  }

  // Initialize with dummy data for immediate UI response
  private initializeDummyData() {
    this.projects = [
      {
        id: 'proj_001',
        name: 'Sales Outreach Campaign',
        description: 'AI-powered sales calls for lead generation',
        environment: 'production',
        owner_clerk_id: 'user_demo_123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
        is_active: true,
        user_role: 'admin',
        api_token: 'sk_test_123456789'
      },
      {
        id: 'proj_002',
        name: 'Customer Support Hub',
        description: 'AI customer service automation',
        environment: 'production',
        owner_clerk_id: 'user_demo_123',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-16T00:00:00Z',
        is_active: true,
        user_role: 'admin',
        api_token: 'sk_test_987654321'
      }
    ]

    this.agents = [
      {
        id: 'agent_001',
        name: 'Support Agent Alpha',
        agent_type: 'customer_support',
        configuration: {
          voice: 'alloy',
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 500
        },
        project_id: 'proj_002',
        environment: 'production',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: 'Extract customer satisfaction, issue type, resolution status',
        field_extractor_keys: ['customer_satisfaction', 'issue_type', 'issue_resolved', 'escalation_required']
      },
      {
        id: 'agent_003',
        name: 'Sales Caller Pro',
        agent_type: 'sales_outreach',
        configuration: {
          voice: 'nova',
          model: 'gpt-4',
          temperature: 0.8,
          max_tokens: 400
        },
        project_id: 'proj_001',
        environment: 'production',
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-17T00:00:00Z',
        is_active: true,
        field_extractor: true,
        field_extractor_prompt: 'Extract lead score, interest level, budget qualification',
        field_extractor_keys: ['lead_score', 'interest_level', 'budget_qualified', 'decision_timeframe', 'next_action']
      }
    ]

    this.callLogs = []
    this.customOverviewMetrics = []
    this.transcriptLogs = []
    this.users = this.getDefaultUsers()
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
        updated_at: '2024-01-15T00:00:00Z',
        is_active: true
      }
    ]
  }

  // Data access methods
  getProjects(): MockProject[] {
    return this.projects || []
  }

  getProjectById(id: string): MockProject | undefined {
    return this.projects?.find(p => p.id === id)
  }

  getAgents(projectId?: string): MockAgent[] {
    if (!this.agents) return []
    if (projectId) {
      return this.agents.filter(a => a.project_id === projectId)
    }
    return this.agents
  }

  getAgentById(id: string): MockAgent | undefined {
    return this.agents?.find(a => a.id === id)
  }

  getCallLogs(agentId?: string): MockCallLog[] {
    console.log(`📊 getCallLogs called with agentId: ${agentId}, total logs: ${this.callLogs?.length || 0}`)
    
    if (!this.callLogs) {
      console.warn('📊 getCallLogs: callLogs not initialized')
      return []
    }
    
    if (agentId) {
      const filtered = this.callLogs.filter(c => c.agent_id === agentId)
      console.log(`📊 getCallLogs: Filtered to ${filtered.length} logs for agent ${agentId}`)
      return filtered
    }
    
    return this.callLogs
  }

  // Analytics method - always fetch fresh data if needed
  getAnalytics(agentId?: string, dateFrom?: string, dateTo?: string) {
    console.log(`📊 getAnalytics called with agentId: ${agentId}, callLogs available: ${this.callLogs?.length || 0}`)
    
    // If no call logs and we're in browser, try syncing first
    if ((!this.callLogs || this.callLogs.length === 0) && typeof window !== 'undefined' && !this.isLoading) {
      console.log('🔄 getAnalytics: No call logs, triggering sync...')
      this.syncWithAPI()
      // Return empty analytics for now, will be updated after sync
      return this.getEmptyAnalytics()
    }
    
    console.log(`📊 getAnalytics: Processing with ${this.callLogs?.length || 0} call logs`)
    
    // Get agent info for context-specific analytics
    const agent = agentId ? this.getAgentById(agentId) : null
    console.log(`📊 Found agent:`, agent ? agent.name : 'No agent found')
    
    // Generate rich analytics data based on agent type and use case
    return this.generateEnhancedAnalytics(agent ?? null, dateFrom, dateTo)
  }

  private generateEnhancedAnalytics(agent: MockAgent | null, dateFrom?: string, dateTo?: string) {
    // Defensive check - ensure callLogs is initialized
    if (!this.callLogs) {
      console.warn('📊 generateEnhancedAnalytics: callLogs not initialized, returning empty analytics')
      return this.getEmptyAnalytics()
    }

    console.log(`📊 generateEnhancedAnalytics: Processing ${this.callLogs.length} total call logs`)
    
    let logs = this.callLogs
    if (agent) {
      logs = logs.filter(c => c.agent_id === agent.id)
      console.log(`📊 generateEnhancedAnalytics: Filtered to ${logs.length} calls for agent ${agent.id}`)
    }

    // Apply date filtering
    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom) : new Date('1900-01-01')
      const toDate = dateTo ? new Date(dateTo) : new Date('2100-01-01')
      logs = logs.filter(log => {
        const logDate = new Date(log.created_at)
        return logDate >= fromDate && logDate <= toDate
      })
    }

    // Calculate basic metrics
    const totalCalls = logs.length
    const successfulCalls = logs.filter(log => 
      log.call_ended_reason === 'completed' || 
      log.call_ended_reason === 'user_hangup'
    ).length
    
    const totalDuration = logs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0)
    const totalMinutes = Math.round(totalDuration / 60)
    
    const totalCost = logs.reduce((sum, log) => 
      sum + (log.total_stt_cost || 0) + (log.total_tts_cost || 0) + (log.total_llm_cost || 0), 0
    )
    
    const averageLatency = logs.length > 0 ? 
      logs.reduce((sum, log) => sum + (log.avg_latency || 0), 0) / logs.length : 0
    
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0

    console.log(`📊 generateEnhancedAnalytics: Calculated metrics - calls: ${totalCalls}, duration: ${totalDuration}, cost: ${totalCost}`)

    return {
      totalCalls,
      successfulCalls,
      totalMinutes,
      totalDuration,
      totalCost,
      averageLatency,
      successRate,
      dailyData: this.generateDailyData(logs),
      hourlyDistribution: this.generateHourlyDistribution(logs),
      weeklyTrends: this.generateWeeklyTrends(logs),
      responseTimeDistribution: this.generateResponseTimeDistribution(logs),
      satisfactionScores: this.generateSatisfactionScores(logs),
      conversionMetrics: this.generateConversionMetrics(logs, agent)
    }
  }

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

  // Helper methods for analytics generation
  private generateDailyData(logs: MockCallLog[]) {
    const dailyMap = new Map<string, number>()
    logs.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0]
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1)
    })
    
    return Array.from(dailyMap.entries()).map(([date, count]) => ({
      date,
      calls: count,
      duration: logs
        .filter(log => log.created_at.startsWith(date))
        .reduce((sum, log) => sum + (log.duration_seconds || 0), 0)
    }))
  }

  private generateHourlyDistribution(logs: MockCallLog[]) {
    const hourlyMap = new Map<number, number>()
    logs.forEach(log => {
      const hour = new Date(log.created_at).getHours()
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1)
    })
    
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      calls: hourlyMap.get(hour) || 0
    }))
  }

  private generateWeeklyTrends(logs: MockCallLog[]) {
    const weeklyMap = new Map<string, { calls: number; duration: number }>()
    logs.forEach(log => {
      const week = this.getWeekKey(new Date(log.created_at))
      const current = weeklyMap.get(week) || { calls: 0, duration: 0 }
      weeklyMap.set(week, {
        calls: current.calls + 1,
        duration: current.duration + (log.duration_seconds || 0)
      })
    })
    
    return Array.from(weeklyMap.entries()).map(([week, data]) => ({
      week,
      calls: data.calls,
      avgDuration: data.calls > 0 ? data.duration / data.calls : 0
    }))
  }

  private generateResponseTimeDistribution(logs: MockCallLog[]) {
    const ranges = [
      { min: 0, max: 1000, label: '0-1s' },
      { min: 1000, max: 2000, label: '1-2s' },
      { min: 2000, max: 3000, label: '2-3s' },
      { min: 3000, max: Infinity, label: '3s+' }
    ]
    
    return ranges.map(range => ({
      range: range.label,
      count: logs.filter(log => 
        (log.avg_latency || 0) >= range.min && (log.avg_latency || 0) < range.max
      ).length
    }))
  }

  private generateSatisfactionScores(logs: MockCallLog[]) {
    const scores = logs
      .map(log => log.metadata?.customer_satisfaction)
      .filter(score => score !== undefined && score !== null)
    
    if (scores.length === 0) return []
    
    const scoreMap = new Map<number, number>()
    scores.forEach(score => {
      scoreMap.set(score, (scoreMap.get(score) || 0) + 1)
    })
    
    return Array.from(scoreMap.entries()).map(([score, count]) => ({
      score,
      count,
      percentage: (count / scores.length) * 100
    }))
  }

  private generateConversionMetrics(logs: MockCallLog[], agent: MockAgent | null) {
    if (!agent || agent.agent_type !== 'sales_outreach') {
      return []
    }
    
    const qualified = logs.filter(log => 
      log.metadata?.budget_qualified === true || log.metadata?.lead_score >= 7
    ).length
    
    const interested = logs.filter(log => 
      log.metadata?.interest_level === 'high' || log.metadata?.interest_level === 'medium'
    ).length
    
    const followUp = logs.filter(log => 
      log.metadata?.next_action && log.metadata.next_action !== 'none'
    ).length
    
    return [
      { metric: 'Qualified Leads', value: qualified, total: logs.length },
      { metric: 'Interested Prospects', value: interested, total: logs.length },
      { metric: 'Follow-up Required', value: followUp, total: logs.length }
    ]
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear()
    const week = Math.ceil(date.getDate() / 7)
    const month = date.getMonth() + 1
    return `${year}-${month.toString().padStart(2, '0')}-W${week}`
  }

  // Custom overview metrics methods
  getCustomOverviewMetrics(agentId?: string): CustomOverviewMetric[] {
    if (!this.customOverviewMetrics) return []
    if (agentId) {
      return this.customOverviewMetrics.filter(m => m.agentId === agentId)
    }
    return this.customOverviewMetrics
  }

  // Other required methods...
  getTranscriptLogs(): any[] {
    return this.transcriptLogs || []
  }

  getUserByClerkId(clerkId: string): MockUser | undefined {
    return this.users?.find(u => u.clerk_id === clerkId)
  }

  getUsers(): MockUser[] {
    return this.users || []
  }
}

// Create singleton instance
const MockDataService = new MockDataStore()

// Make it globally available for debugging
if (typeof window !== 'undefined') {
  ;(window as any).MockDataService = MockDataService
}

export { MockDataService }
