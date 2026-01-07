import { supabase } from '@/lib/supabase'
import { MetricGroup } from '@/types/metricGroups'

export class MetricGroupService {
  static async getMetricGroups(
    projectId: string,
    agentId: string,
    userEmail: string
  ): Promise<MetricGroup[]> {
    try {
      const { data, error } = await supabase
        .from('pype_voice_metric_groups')
        .select('*')
        .eq('project_id', projectId)
        .eq('agent_id', agentId)
        .eq('user_email', userEmail)
        .order('order', { ascending: true })

      if (error) {
        console.error('Supabase error loading metric groups:', error)
        throw error
      }
      
      return data || []
    } catch (error) {
      console.error('Failed to load metric groups:', error)
      return []
    }
  }

  static async createMetricGroup(
    group: Omit<MetricGroup, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; data?: MetricGroup; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('pype_voice_metric_groups')
        .insert({
          name: group.name,
          project_id: group.project_id,
          agent_id: group.agent_id,
          user_email: group.user_email,
          metric_ids: group.metric_ids,
          chart_ids: group.chart_ids,
          order: group.order,
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase error creating metric group:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error: any) {
      console.error('Failed to create metric group:', error)
      return { success: false, error: error.message }
    }
  }

  static async updateMetricGroup(
    id: string,
    updates: Partial<MetricGroup>
  ): Promise<{ success: boolean; data?: MetricGroup; error?: string }> {
    try {
      const updateData: any = {}
      
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.metric_ids !== undefined) updateData.metric_ids = updates.metric_ids
      if (updates.chart_ids !== undefined) updateData.chart_ids = updates.chart_ids
      if (updates.order !== undefined) updateData.order = updates.order

      const { data, error } = await supabase
        .from('pype_voice_metric_groups')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Supabase error updating metric group:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error: any) {
      console.error('Failed to update metric group:', error)
      return { success: false, error: error.message }
    }
  }

  static async deleteMetricGroup(
    id: string,
    projectId: string,
    agentId: string,
    userEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('pype_voice_metric_groups')
        .delete()
        .eq('id', id)
        .eq('project_id', projectId)
        .eq('agent_id', agentId)
        .eq('user_email', userEmail)

      if (error) {
        console.error('Supabase error deleting metric group:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Failed to delete metric group:', error)
      return { success: false, error: error.message }
    }
  }

  static async reorderGroups(
    groups: { id: string; order: number }[],
    projectId: string,
    agentId: string,
    userEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update all groups' order
      const updates = groups.map((g) =>
        supabase
          .from('pype_voice_metric_groups')
          .update({ order: g.order })
          .eq('id', g.id)
          .eq('project_id', projectId)
          .eq('agent_id', agentId)
          .eq('user_email', userEmail)
      )

      await Promise.all(updates)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to reorder metric groups:', error)
      return { success: false, error: error.message }
    }
  }
}