import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface OverviewData {
  totalCalls: number
  totalMinutes: number
  successfulCalls: number
  successRate: number
  averageLatency: number
  totalCost:number
  uniqueCustomers: number
  dailyData: Array<{
    date: string
    dateKey: string
    calls: number
    minutes: number
  }>
}

interface UseOverviewQueryProps {
  agentId: string
  dateFrom: string // 'YYYY-MM-DD'
  dateTo: string   // 'YYYY-MM-DD'
}

export const useOverviewQuery = ({ agentId, dateFrom, dateTo }: UseOverviewQueryProps) => {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        setLoading(true)
        setError(null)
    
        // 🔄 Call the PostgreSQL function to refresh the materialized view
        const { error: refreshError } = await supabase.rpc('refresh_call_summary')
        if (refreshError) throw refreshError

    
        // ✅ Then query the refreshed materialized view
        const { data: dailyStats, error: queryError } = await supabase
          .from('call_summary_materialized')
          .select(`
            call_date,
            calls,
            total_minutes,
            avg_latency,
            unique_customers,
            successful_calls,
            success_rate,
            total_cost
          `)
          .eq('agent_id', agentId)
          .gte('call_date', dateFrom)
          .lte('call_date', dateTo)
          .order('call_date', { ascending: true })
            

        if (queryError) throw queryError
            
        
        const totalCalls = dailyStats?.reduce((sum, day) => sum + day.calls, 0) || 0
        const successfulCalls = dailyStats?.reduce((sum, day) => sum + day.successful_calls, 0) || 0
        const totalCost = dailyStats?.reduce((sum, day) => sum + day.total_cost, 0) || 0


    
        const typedData: OverviewData = {
          totalCalls,
          totalCost,
          totalMinutes: dailyStats?.reduce((sum, day) => sum + day.total_minutes, 0) || 0,
          successfulCalls,
          successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
          averageLatency: dailyStats && dailyStats.length > 0
            ? dailyStats.reduce((sum, day) => sum + day.avg_latency, 0) / dailyStats.length
            : 0,
          uniqueCustomers: dailyStats?.reduce((sum, day) => sum + day.unique_customers, 0) || 0,
          dailyData: dailyStats?.map(day => ({
            date: day.call_date,
            dateKey: day.call_date,
            calls: day.calls,
            minutes: day.total_minutes,
            avg_latency: day.avg_latency
          })) || []
          
        }
    
        setData(typedData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    

    if (agentId && dateFrom && dateTo) {
      fetchOverviewData()
    }
  }, [agentId, dateFrom, dateTo])

  return { data, loading, error }
}