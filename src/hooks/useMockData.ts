// Mock Data Hooks - Replace all database hooks with mock data
'use client'
import { useState, useEffect, useCallback } from 'react'
import { MockDataService } from '@/lib/mockData'

// Replace useSupabaseQuery hook
export const useMockQuery = (table: string, options: any = {}) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      let mockData: any[] = []
      
      // Route to appropriate API endpoints based on table
      switch (table) {
        case 'pype_voice_projects':
          const projectsResponse = await fetch('/api/projects')
          if (projectsResponse.ok) {
            mockData = await projectsResponse.json()
          }
          break
        case 'pype_voice_agents':
          // Check if there's an id filter (for individual agent)
          const agentIdFilter = options.filters?.find((f: any) => f.column === 'id' && f.operator === 'eq')
          if (agentIdFilter) {
            const agentResponse = await fetch(`/api/agents/${agentIdFilter.value}`)
            if (agentResponse.ok) {
              const agent = await agentResponse.json()
              mockData = [agent] // Wrap in array since the hook expects an array
            }
          } else {
            // Check if there's a project_id filter (for agents by project)
            const projectIdFilter = options.filters?.find((f: any) => f.column === 'project_id' && f.operator === 'eq')
            if (projectIdFilter) {
              const agentsResponse = await fetch(`/api/agents?project_id=${projectIdFilter.value}`)
              if (agentsResponse.ok) {
                mockData = await agentsResponse.json()
              }
            }
          }
          break
        case 'pype_voice_call_logs':
          try {
            mockData = MockDataService.getCallLogs() || []
          } catch (e) {
            console.warn('Error fetching call logs:', e)
            mockData = []
          }
          break
        case 'pype_voice_metrics_logs':
          try {
            // Transcript logs mock (no parameter support in current service)
            mockData = MockDataService.getTranscriptLogs() || []
          } catch (e) {
            console.warn('Error fetching transcript logs:', e)
            mockData = []
          }
          break
        case 'pype_voice_users':
          try {
            const user = MockDataService.getUserByClerkId('user_demo_123')
            mockData = user ? [user] : []
          } catch (e) {
            console.warn('Error fetching user:', e)
            mockData = []
          }
          break
        default:
          mockData = []
      }

      // Apply filters if provided (skip for metrics_logs as we handle session_id filter directly)
      // For agents, skip project_id filter as it's already applied in the API call
      if (options.filters && Array.isArray(options.filters) && table !== 'pype_voice_metrics_logs') {
        const filtersToApply = table === 'pype_voice_agents' 
          ? options.filters.filter((f: any) => f.column !== 'project_id')
          : options.filters
          
        filtersToApply.forEach((filter: any) => {
          mockData = mockData.filter(item => {
            const value = item[filter.column]
            switch (filter.operator) {
              case 'eq':
                return value === filter.value
              case 'neq':
                return value !== filter.value
              case 'gt':
                return value > filter.value
              case 'gte':
                return value >= filter.value
              case 'lt':
                return value < filter.value
              case 'lte':
                return value <= filter.value
              case 'like':
                return String(value).toLowerCase().includes(String(filter.value).toLowerCase())
              case 'in':
                return Array.isArray(filter.value) && filter.value.includes(value)
              default:
                return true
            }
          })
        })
      }

      // Apply ordering
      if (options.orderBy) {
        mockData.sort((a, b) => {
          const aVal = a[options.orderBy.column]
          const bVal = b[options.orderBy.column]
          
          if (options.orderBy.ascending) {
            return aVal > bVal ? 1 : -1
          } else {
            return aVal < bVal ? 1 : -1
          }
        })
      }

      // Apply limit
      if (options.limit) {
        mockData = mockData.slice(0, options.limit)
      }

      setData(mockData)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch mock data')
    } finally {
      setLoading(false)
    }
  }, [table, JSON.stringify(options)])

  useEffect(() => {
    fetchData()

    // Listen for data changes and refetch automatically
    const handleDataChange = (changeData: { type: string; data: any }) => {
      // Map table names to change events
      const tableEventMap: { [key: string]: string } = {
        'pype_voice_projects': 'projects',
        'pype_voice_agents': 'agents', 
        'pype_voice_call_logs': 'callLogs',
        'pype_voice_metrics_logs': 'transcriptLogs',
        'pype_voice_custom_metrics': 'metrics'
      }

      if (tableEventMap[table] === changeData.type) {
        console.log(`🔄 Auto-refreshing ${table} data due to changes`)
        fetchData()
      }
    }

    // Listen for general data changes
    try {
      MockDataService.on('data:changed', handleDataChange)
    } catch (e) {
      console.warn('Error setting up data change listener:', e)
    }

    // Cleanup listener on unmount
    return () => {
      try {
        MockDataService.off('data:changed', handleDataChange)
      } catch (e) {
        console.warn('Error removing data change listener:', e)
      }
    }
  }, [fetchData, table])

  return { data, loading, error, refetch: fetchData }
}

// Replace useSupabaseQuery with alias
export const useSupabaseQuery = useMockQuery

// Mock infinite scroll hook
export const useInfiniteScroll = (table: string, options: any = {}) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (reset = false) => {
    setLoading(true)
    setError(null)
    
    try {
      // Use mock data service
      let mockData: any[] = []
      
      switch (table) {
        case 'pype_voice_call_logs':
          try {
            // Extract agent_id from filters if present
            let agentId = undefined
            if (options.filters && Array.isArray(options.filters)) {
              const agentFilter = options.filters.find((f: any) => f.column === 'agent_id' && f.operator === 'eq')
              if (agentFilter) {
                agentId = agentFilter.value
              }
            }
            
            console.log('useInfiniteScroll: Fetching call logs for agent:', agentId)
            mockData = MockDataService.getCallLogs(agentId) || []
            console.log('useInfiniteScroll: Found call logs:', mockData.length)
          } catch (e) {
            console.warn('Error fetching call logs in useInfiniteScroll:', e)
            mockData = []
          }
          break
        default:
          mockData = []
      }

      if (reset) {
        setData(mockData)
      } else {
        setData(prev => [...prev, ...mockData])
      }
      
      setHasMore(false) // Mock data doesn't need infinite scroll
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [table])

  const loadMore = useCallback(() => {
    // Mock implementation - no actual loading needed
  }, [])

  const refresh = useCallback(() => {
    fetchData(true)
  }, [fetchData])

  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  return { data, loading, hasMore, error, loadMore, refresh }
}

// Mock overview query hook
export const useOverviewQuery = ({ agentId, dateFrom, dateTo }: {
  agentId: string
  dateFrom: string
  dateTo: string
}) => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get analytics from mock data service
        let analytics
        try {
          analytics = MockDataService.getAnalytics(agentId, dateFrom, dateTo)
        } catch (e) {
          console.warn('Error fetching analytics:', e)
          // Return default analytics structure
          analytics = {
            totalCalls: 0,
            successfulCalls: 0,
            totalMinutes: 0,
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
        
        // Return the full analytics data structure for Overview component
        const overviewData = {
          // Core metrics
          totalCalls: analytics.totalCalls,
          successfulCalls: analytics.successfulCalls,
          totalMinutes: analytics.totalMinutes,
          totalCost: analytics.totalCost,
          averageLatency: analytics.averageLatency,
          successRate: analytics.successRate,
          
          // Chart data - this is what was missing!
          dailyData: analytics.dailyData,
          hourlyDistribution: analytics.hourlyDistribution,
          weeklyTrends: analytics.weeklyTrends,
          
          // Performance metrics
          responseTimeDistribution: analytics.responseTimeDistribution,
          satisfactionScores: analytics.satisfactionScores,
          conversionMetrics: analytics.conversionMetrics,
          
          // Legacy format for backward compatibility
          dailyStats: analytics.dailyData.map((day: any) => {
            const totalMinutes = typeof day.minutes === 'number'
              ? day.minutes
              : (typeof day.duration === 'number' ? day.duration : 0)
            const successfulCalls = typeof day.successful === 'number' ? day.successful : 0
            const callsCount = typeof day.calls === 'number' ? day.calls : 0
            const avgLatency = typeof day.avg_latency === 'number' ? day.avg_latency : 0
            const totalCost = typeof day.cost === 'number' ? day.cost : 0

            return {
              call_date: day.date,
              calls: callsCount,
              total_minutes: totalMinutes,
              avg_latency: avgLatency,
              unique_customers: callsCount,
              successful_calls: successfulCalls,
              success_rate: callsCount > 0 ? (successfulCalls / callsCount) * 100 : 0,
              total_cost: totalCost
            }
          })
        }

        setData(overviewData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchOverviewData()

    // Listen for data changes that affect analytics
    const handleDataChange = (changeData: { type: string; data: any }) => {
      // Analytics can be affected by changes to call logs, agents, or metrics
      if (['callLogs', 'agents', 'metrics'].includes(changeData.type)) {
        console.log(`🔄 Auto-refreshing overview analytics due to ${changeData.type} changes`)
        fetchOverviewData()
      }
    }

    // Listen for data changes
    try {
      MockDataService.on('data:changed', handleDataChange)
    } catch (e) {
      console.warn('Error setting up analytics data change listener:', e)
    }

    // Cleanup listener
    return () => {
      try {
        MockDataService.off('data:changed', handleDataChange)
      } catch (e) {
        console.warn('Error removing analytics data change listener:', e)
      }
    }
  }, [agentId, dateFrom, dateTo])

  return { data, loading, error }
}

// Mock custom totals hook
export const useCustomTotals = ({
  projectId,
  agentId,
  dateFrom,
  dateTo,
  autoCalculate = true
}: any) => {
  const [configs, setConfigs] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    setConfigs([]) // Mock: no custom configs
    setLoading(false)
  }, [projectId, agentId])

  const calculateResults = useCallback(async () => {
    setCalculating(true)
    setResults([]) // Mock: no results
    setCalculating(false)
  }, [configs, agentId, dateFrom, dateTo])

  const saveConfig = useCallback(async (config: any): Promise<boolean> => {
    // Mock: always succeeds
    return true
  }, [])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  return {
    configs,
    results,
    loading,
    calculating,
    error,
    loadConfigs,
    calculateResults,
    saveConfig
  }
}

// Mock dynamic fields hook
export const useDynamicFields = (agentId?: string) => {
  const [metadataFields, setMetadataFields] = useState<string[]>(['customer_satisfaction', 'issue_resolved'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const transcriptionFields: string[] = ['transcript', 'duration', 'call_ended_reason']
  
  useEffect(() => {
    const fetchAgentData = async () => {
      if (!agentId) return
      
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/agents/${agentId}`)
        if (response.ok) {
          const agent = await response.json()
          
          if (agent?.field_extractor && agent.field_extractor_keys) {
            setMetadataFields(agent.field_extractor_keys)
          } else {
            // Default metadata fields if no field extractor
            setMetadataFields(['customer_satisfaction', 'issue_resolved'])
          }
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAgentData()
  }, [agentId])
  
  return {
    metadataFields,
    transcriptionFields,
    loading,
    error
  }
}