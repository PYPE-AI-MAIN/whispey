import { useQuery } from '@tanstack/react-query'

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
  /** Only fetch while true. Pass activeTab === 'overview' to avoid
   *  triggering the API call while the user is on other tabs. */
  enabled?: boolean
}

export const useOverviewQuery = ({ agentId, dateFrom, dateTo, enabled = true }: UseOverviewQueryProps) => {
  const { data, isLoading, error } = useQuery<OverviewData>({
    queryKey: ['overview', agentId, dateFrom, dateTo],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ dateFrom, dateTo })
      const res = await fetch(
        `/api/agents/${agentId}/overview/data?${params.toString()}`,
        { signal }
      )
      const json = (await res.json()) as { data?: OverviewData; error?: string }
      if (!res.ok) throw new Error(json.error || res.statusText)
      return json.data!
    },
    enabled: !!agentId && !!dateFrom && !!dateTo && enabled,
    // Data is considered fresh for 5 minutes — switching tabs won't re-fetch
    staleTime: 5 * 60 * 1000,
    // Keep cached data for 15 minutes after the component is hidden
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
