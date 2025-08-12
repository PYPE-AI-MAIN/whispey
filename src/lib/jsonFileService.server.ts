// JSON File Service - Server-side only (uses fs module)
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const DEFAULT_DATA_FILE = path.join(DATA_DIR, 'default-data.json')
const CURRENT_DATA_FILE = path.join(DATA_DIR, 'current-data.json')

export interface JsonData {
  projects: any[]
  agents: any[]
  users: any[]
  callLogs: any[]
}

export class JsonFileService {
  private static instance: JsonFileService
  private data: JsonData | null = null

  private constructor() {
    this.ensureDataFiles()
  }

  public static getInstance(): JsonFileService {
    if (!JsonFileService.instance) {
      JsonFileService.instance = new JsonFileService()
    }
    return JsonFileService.instance
  }

  private ensureDataFiles(): void {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true })
      }

      // If current data file doesn't exist, copy from default
      if (!fs.existsSync(CURRENT_DATA_FILE)) {
        if (fs.existsSync(DEFAULT_DATA_FILE)) {
          fs.copyFileSync(DEFAULT_DATA_FILE, CURRENT_DATA_FILE)
        } else {
          // Create minimal default data
          const minimalData: JsonData = {
            projects: [],
            agents: [],
            users: [],
            callLogs: []
          }
          fs.writeFileSync(CURRENT_DATA_FILE, JSON.stringify(minimalData, null, 2))
        }
      }
    } catch (error) {
      console.error('Error ensuring data files:', error)
    }
  }

  public readData(): JsonData {
    try {
      // Always read fresh data from file to avoid cache issues
      const rawData = fs.readFileSync(CURRENT_DATA_FILE, 'utf8')
      this.data = JSON.parse(rawData)
      return this.data!
    } catch (error) {
      console.error('Error reading data file:', error)
      // Return empty data structure if file is corrupted
      return {
        projects: [],
        agents: [],
        users: [],
        callLogs: []
      }
    }
  }

  public writeData(data: JsonData): boolean {
    try {
      fs.writeFileSync(CURRENT_DATA_FILE, JSON.stringify(data, null, 2))
      this.data = data // Update cached data
      return true
    } catch (error) {
      console.error('Error writing data file:', error)
      return false
    }
  }

  public resetToDefault(): boolean {
    try {
      if (fs.existsSync(DEFAULT_DATA_FILE)) {
        fs.copyFileSync(DEFAULT_DATA_FILE, CURRENT_DATA_FILE)
        this.data = null // Clear cache to force reload
        return true
      }
      return false
    } catch (error) {
      console.error('Error resetting to default:', error)
      return false
    }
  }

  public getDefaultData(): JsonData {
    try {
      const rawData = fs.readFileSync(DEFAULT_DATA_FILE, 'utf8')
      return JSON.parse(rawData)
    } catch (error) {
      console.error('Error reading default data file:', error)
      return {
        projects: [],
        agents: [],
        users: [],
        callLogs: []
      }
    }
  }

  public backupCurrentData(): string {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFile = path.join(DATA_DIR, `backup-${timestamp}.json`)
      fs.copyFileSync(CURRENT_DATA_FILE, backupFile)
      return backupFile
    } catch (error) {
      console.error('Error creating backup:', error)
      return ''
    }
  }

  // CRUD Operations for Projects
  public getProjects(): any[] {
    const data = this.readData()
    return data.projects || []
  }

  public getProjectById(id: string): any | null {
    const projects = this.getProjects()
    return projects.find(p => p.id === id) || null
  }

  public addProject(project: any): boolean {
    const data = this.readData()
    data.projects = data.projects || []
    data.projects.push({
      ...project,
      id: project.id || `proj_${Date.now()}`,
      created_at: project.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    })
    return this.writeData(data)
  }

  public updateProject(id: string, updates: any): boolean {
    const data = this.readData()
    const projectIndex = data.projects.findIndex(p => p.id === id)
    if (projectIndex === -1) return false

    data.projects[projectIndex] = {
      ...data.projects[projectIndex],
      ...updates,
      updated_at: new Date().toISOString()
    }
    return this.writeData(data)
  }

  public deleteProject(id: string): boolean {
    const data = this.readData()
    const initialLength = data.projects.length
    data.projects = data.projects.filter(p => p.id !== id)
    
    // Also remove associated agents
    data.agents = data.agents.filter(a => a.project_id !== id)
    
    // Remove associated call logs
    data.callLogs = data.callLogs.filter(c => {
      const agent = data.agents.find(a => a.id === c.agent_id)
      return agent?.project_id !== id
    })
    
    return data.projects.length !== initialLength && this.writeData(data)
  }

  // CRUD Operations for Agents
  public getAgents(projectId?: string): any[] {
    const data = this.readData()
    const agents = data.agents || []
    return projectId ? agents.filter(a => a.project_id === projectId) : agents
  }

  public getAgentById(id: string): any | null {
    const agents = this.getAgents()
    return agents.find(a => a.id === id) || null
  }

  public addAgent(agent: any): boolean {
    const data = this.readData()
    data.agents = data.agents || []
    data.agents.push({
      ...agent,
      id: agent.id || `agent_${Date.now()}`,
      created_at: agent.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    })
    return this.writeData(data)
  }

  public updateAgent(id: string, updates: any): boolean {
    const data = this.readData()
    const agentIndex = data.agents.findIndex(a => a.id === id)
    if (agentIndex === -1) return false

    data.agents[agentIndex] = {
      ...data.agents[agentIndex],
      ...updates,
      updated_at: new Date().toISOString()
    }
    return this.writeData(data)
  }

  public deleteAgent(id: string): boolean {
    const data = this.readData()
    const initialLength = data.agents.length
    data.agents = data.agents.filter(a => a.id !== id)
    
    // Remove associated call logs
    data.callLogs = data.callLogs.filter(c => c.agent_id !== id)
    
    return data.agents.length !== initialLength && this.writeData(data)
  }

  // CRUD Operations for Call Logs
  public getCallLogs(agentId?: string): any[] {
    const data = this.readData()
    const callLogs = data.callLogs || []
    return agentId ? callLogs.filter(c => c.agent_id === agentId) : callLogs
  }

  public addCallLog(callLog: any): boolean {
    const data = this.readData()
    data.callLogs = data.callLogs || []
    data.callLogs.push({
      ...callLog,
      id: callLog.id || `call_${Date.now()}`,
      created_at: callLog.created_at || new Date().toISOString()
    })
    return this.writeData(data)
  }

  // User operations
  public getUserByClerkId(clerkId: string): any | null {
    const data = this.readData()
    const users = data.users || []
    return users.find(u => u.clerk_id === clerkId) || null
  }

  // Analytics helper
  public getAnalytics(agentId?: string, dateFrom?: string, dateTo?: string): any {
    const callLogs = this.getCallLogs(agentId)
    
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

export const jsonFileService = JsonFileService.getInstance()
