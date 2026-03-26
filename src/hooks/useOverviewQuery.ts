import { useState, useEffect } from 'react'

interface OverviewData {
  totalCalls: number
  totalMinutes: number
  totalBillingMinutes: number
  successfulCalls: number
  successRate: number
  averageLatency: number
  totalCost: number
  uniqueCustomers: number
  dailyData: Array<{
    date: string
    dateKey: string
    calls: number
    minutes: number
    avg_latency?: number
  }>
}

interface UseOverviewQueryProps {
  agentId: string
  dateFrom: string
  dateTo: string
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

        const params = new URLSearchParams({ dateFrom, dateTo })
        const res = await fetch(`/api/agents/${agentId}/overview/data?${params.toString()}`)
        const json = (await res.json()) as { data?: OverviewData; error?: string }
        if (!res.ok) {
          throw new Error(json.error || res.statusText)
        }
        if (json.data) {
          setData(json.data)
        } else {
          setData(null)
        }
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
