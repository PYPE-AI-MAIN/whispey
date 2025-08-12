// Client-side JSON Data Service - Uses API calls instead of direct file access
'use client'

export interface JsonData {
  projects: any[]
  agents: any[]
  users: any[]
  callLogs: any[]
}

export class ClientJsonDataService {
  private static instance: ClientJsonDataService
  private cache: JsonData | null = null

  private constructor() {}

  public static getInstance(): ClientJsonDataService {
    if (!ClientJsonDataService.instance) {
      ClientJsonDataService.instance = new ClientJsonDataService()
    }
    return ClientJsonDataService.instance
  }

  // Clear cache to force fresh data fetch
  private clearCache() {
    this.cache = null
  }

  public async readData(): Promise<JsonData> {
    try {
      if (!this.cache) {
        const response = await fetch('/api/data?type=current')
        if (!response.ok) throw new Error('Failed to fetch data')
        this.cache = await response.json()
      }
      return this.cache!
    } catch (error) {
      console.error('Error reading data:', error)
      return {
        projects: [],
        agents: [],
        users: [],
        callLogs: []
      }
    }
  }

  public async writeData(data: JsonData): Promise<boolean> {
    try {
      const response = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (response.ok) {
        this.cache = data // Update cache
        return true
      }
      return false
    } catch (error) {
      console.error('Error writing data:', error)
      return false
    }
  }

  public async resetToDefault(): Promise<boolean> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      })
      
      if (response.ok) {
        this.clearCache() // Clear cache to force reload
        return true
      }
      return false
    } catch (error) {
      console.error('Error resetting to default:', error)
      return false
    }
  }

  public async getDefaultData(): Promise<JsonData> {
    try {
      const response = await fetch('/api/data?type=default')
      if (!response.ok) throw new Error('Failed to fetch default data')
      return await response.json()
    } catch (error) {
      console.error('Error reading default data:', error)
      return {
        projects: [],
        agents: [],
        users: [],
        callLogs: []
      }
    }
  }

  public async backupCurrentData(): Promise<string> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup' })
      })
      
      if (response.ok) {
        const result = await response.json()
        return result.backupFile || ''
      }
      return ''
    } catch (error) {
      console.error('Error creating backup:', error)
      return ''
    }
  }

  // CRUD Operations for Projects
  public async getProjects(): Promise<any[]> {
    const data = await this.readData()
    return data.projects || []
  }

  public async getProjectById(id: string): Promise<any | null> {
    const projects = await this.getProjects()
    return projects.find(p => p.id === id) || null
  }

  public async addProject(project: any): Promise<boolean> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          table: 'projects',
          data: project
        })
      })
      
      if (response.ok) {
        this.clearCache() // Clear cache to force reload
        return true
      }
      return false
    } catch (error) {
      console.error('Error adding project:', error)
      return false
    }
  }

  public async updateProject(id: string, updates: any): Promise<boolean> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          table: 'projects',
          id,
          data: updates
        })
      })
      
      if (response.ok) {
        this.clearCache() // Clear cache to force reload
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating project:', error)
      return false
    }
  }

  public async deleteProject(id: string): Promise<boolean> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          table: 'projects',
          id
        })
      })
      
      if (response.ok) {
        this.clearCache() // Clear cache to force reload
        return true
      }
      return false
    } catch (error) {
      console.error('Error deleting project:', error)
      return false
    }
  }

  // CRUD Operations for Agents
  public async getAgents(projectId?: string): Promise<any[]> {
    const data = await this.readData()
    const agents = data.agents || []
    return projectId ? agents.filter(a => a.project_id === projectId) : agents
  }

  public async getAgentById(id: string): Promise<any | null> {
    const agents = await this.getAgents()
    return agents.find(a => a.id === id) || null
  }

  public async addAgent(agent: any): Promise<boolean> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          table: 'agents',
          data: agent
        })
      })
      
      if (response.ok) {
        this.clearCache() // Clear cache to force reload
        return true
      }
      return false
    } catch (error) {
      console.error('Error adding agent:', error)
      return false
    }
  }

  public async updateAgent(id: string, updates: any): Promise<boolean> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          table: 'agents',
          id,
          data: updates
        })
      })
      
      if (response.ok) {
        this.clearCache() // Clear cache to force reload
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating agent:', error)
      return false
    }
  }

  public async deleteAgent(id: string): Promise<boolean> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          table: 'agents',
          id
        })
      })
      
      if (response.ok) {
        this.clearCache() // Clear cache to force reload
        return true
      }
      return false
    } catch (error) {
      console.error('Error deleting agent:', error)
      return false
    }
  }

  // CRUD Operations for Call Logs
  public async getCallLogs(agentId?: string): Promise<any[]> {
    const data = await this.readData()
    const callLogs = data.callLogs || []
    return agentId ? callLogs.filter(c => c.agent_id === agentId) : callLogs
  }

  public async addCallLog(callLog: any): Promise<boolean> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          table: 'callLogs',
          data: callLog
        })
      })
      
      if (response.ok) {
        this.clearCache() // Clear cache to force reload
        return true
      }
      return false
    } catch (error) {
      console.error('Error adding call log:', error)
      return false
    }
  }

  // User operations
  public async getUserByClerkId(clerkId: string): Promise<any | null> {
    const data = await this.readData()
    const users = data.users || []
    return users.find(u => u.clerk_id === clerkId) || {
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

  // Analytics helper
  public async getAnalytics(agentId?: string, dateFrom?: string, dateTo?: string): Promise<any> {
    const callLogs = await this.getCallLogs(agentId)
    
    // Filter by date range if provided
    let filteredLogs = callLogs
    if (dateFrom || dateTo) {
      filteredLogs = callLogs.filter(log => {
        const logDate = new Date(log.created_at)
        const fromDate = dateFrom ? new Date(dateFrom) : new Date(0)
        const toDate = dateTo ? new Date(dateTo) : new Date()
        return logDate >= fromDate && logDate <= toDate
      })
    }

    // Calculate basic metrics
    const totalCalls = filteredLogs.length
    const successfulCalls = filteredLogs.filter(log => log.call_ended_reason === 'completed').length
    const totalMinutes = filteredLogs.reduce((sum, log) => sum + (log.duration_seconds / 60), 0)
    const totalCost = filteredLogs.reduce((sum, log) => 
      sum + (log.total_stt_cost || 0) + (log.total_tts_cost || 0) + (log.total_llm_cost || 0), 0
    )
    const averageLatency = filteredLogs.length > 0 
      ? filteredLogs.reduce((sum, log) => sum + (log.avg_latency || 0), 0) / filteredLogs.length 
      : 0
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0

    return {
      totalCalls,
      successfulCalls,
      totalMinutes: Math.round(totalMinutes),
      totalCost: Math.round(totalCost * 100) / 100,
      averageLatency: Math.round(averageLatency),
      successRate: Math.round(successRate),
      dailyData: this.generateDailyData(filteredLogs),
      hourlyDistribution: this.generateHourlyData(filteredLogs)
    }
  }

  private generateDailyData(logs: any[]): any[] {
    const dailyMap = new Map()
    
    logs.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0]
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          calls: 0,
          successful: 0,
          minutes: 0,
          cost: 0,
          avg_latency: 0
        })
      }
      
      const day = dailyMap.get(date)
      day.calls++
      if (log.call_ended_reason === 'completed') day.successful++
      day.minutes += log.duration_seconds / 60
      day.cost += (log.total_stt_cost || 0) + (log.total_tts_cost || 0) + (log.total_llm_cost || 0)
      day.avg_latency += log.avg_latency || 0
    })

    return Array.from(dailyMap.values()).map(day => ({
      ...day,
      avg_latency: day.calls > 0 ? Math.round(day.avg_latency / day.calls) : 0,
      minutes: Math.round(day.minutes),
      cost: Math.round(day.cost * 100) / 100
    })).sort((a, b) => a.date.localeCompare(b.date))
  }

  private generateHourlyData(logs: any[]): any[] {
    const hourlyMap = new Map()
    
    for (let hour = 0; hour < 24; hour++) {
      hourlyMap.set(hour, { hour, calls: 0 })
    }

    logs.forEach(log => {
      const hour = new Date(log.created_at).getHours()
      const hourData = hourlyMap.get(hour)
      if (hourData) hourData.calls++
    })

    return Array.from(hourlyMap.values())
  }
}

export const clientJsonDataService = ClientJsonDataService.getInstance()
