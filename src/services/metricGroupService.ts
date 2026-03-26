import { MetricGroup } from '@/types/metricGroups'

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || res.statusText)
  }
  return json as T
}

export class MetricGroupService {
  static async getMetricGroups(
    projectId: string,
    agentId: string,
    userEmail: string
  ): Promise<MetricGroup[]> {
    try {
      const params = new URLSearchParams({ projectId, agentId })
      const res = await fetch(`/api/metric-groups?${params.toString()}`)
      const json = await parseJson<{ data: MetricGroup[] }>(res)
      return json.data || []
    } catch (error) {
      console.error('Failed to load metric groups:', error)
      return []
    }
  }

  static async createMetricGroup(
    group: Omit<MetricGroup, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; data?: MetricGroup; error?: string }> {
    try {
      const res = await fetch('/api/metric-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(group),
      })
      const json = (await res.json()) as { data?: MetricGroup; error?: string }
      if (!res.ok) {
        return { success: false, error: json.error || res.statusText }
      }
      return { success: true, data: json.data }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  static async updateMetricGroup(
    id: string,
    updates: Partial<MetricGroup>
  ): Promise<{ success: boolean; data?: MetricGroup; error?: string }> {
    try {
      const res = await fetch(`/api/metric-groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = (await res.json()) as { data?: MetricGroup; error?: string }
      if (!res.ok) {
        return { success: false, error: json.error || res.statusText }
      }
      return { success: true, data: json.data }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  static async deleteMetricGroup(
    id: string,
    projectId: string,
    agentId: string,
    userEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/metric-groups/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        return { success: false, error: json.error || res.statusText }
      }
      return { success: true }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  static async reorderGroups(
    groups: { id: string; order: number }[],
    projectId: string,
    agentId: string,
    userEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/metric-groups/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, agentId, groups }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        return { success: false, error: json.error || res.statusText }
      }
      return { success: true }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }
}
