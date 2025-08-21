import { supabase } from '../lib/supabase'
import { CustomTotalConfig, CustomFilter, CustomTotalResult } from '../types/customTotals'

export class CustomTotalsService {
  // Save custom total configuration to database (unchanged)
  static async saveCustomTotal(
    config: CustomTotalConfig, 
    projectId: string, 
    agentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('pype_voice_custom_totals_configs')
        .insert({
          project_id: projectId,
          agent_id: agentId,
          name: config.name,
          description: config.description,
          aggregation: config.aggregation,
          column_name: config.column,
          json_field: config.jsonField,
          filters: config.filters,
          filter_logic: config.filterLogic,
          icon: config.icon,
          color: config.color,
          created_by: config.createdBy
        })

      if (error) {
        console.error('Error saving custom total:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error saving custom total:', error)
      return { success: false, error: 'Failed to save custom total' }
    }
  }

  // Get all custom totals for an agent (unchanged)
  static async getCustomTotals(
    projectId: string, 
    agentId: string
  ): Promise<CustomTotalConfig[]> {
    try {
      const { data, error } = await supabase
        .from('pype_voice_custom_totals_configs')
        .select('*')
        .eq('project_id', projectId)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching custom totals:', error)
        return []
      }

      return data.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        aggregation: row.aggregation,
        column: row.column_name,
        jsonField: row.json_field,
        filters: typeof row.filters === 'string' ? (JSON.parse(row.filters) || []) : (row.filters || []),
        filterLogic: row.filter_logic,
        icon: row.icon || 'calculator',
        color: row.color || 'blue',
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    } catch (error) {
      console.error('Error fetching custom totals:', error)
      return []
    }
  }

  // Calculate custom total value using RPC - UPDATED TO USE RPC
 
// In your CustomTotalsService.calculateCustomTotal method:

static async calculateCustomTotal(
  config: CustomTotalConfig,
  agentId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<CustomTotalResult> {
  try {
    // Ensure proper null handling for json_field
    const jsonField = config.jsonField && config.jsonField.trim() !== '' 
      ? config.jsonField 
      : null;


    const { data, error } = await supabase
      .rpc('calculate_custom_total', {
        p_agent_id: agentId,
        p_aggregation: config.aggregation,
        p_column_name: config.column,
        p_json_field: jsonField, // Pass null instead of empty string
        p_filters: config.filters,
        p_filter_logic: config.filterLogic,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null
      })

    if (error) {
      console.error('Error calculating custom total:', error)
      return {
        configId: config.id,
        value: 0,
        label: config.name,
        error: error.message
      }
    }


    // RPC returns array with one result
    const result = data?.[0]
    if (result?.error_message) {
      return {
        configId: config.id,
        value: 0,
        label: config.name,
        error: result.error_message
      }
    }

    return {
      configId: config.id,
      value: result?.result || 0,
      label: config.name
    }
  } catch (error) {
    console.error('Error calculating custom total:', error)
    return {
      configId: config.id,
      value: 0,
      label: config.name,
      error: 'Calculation failed'
    }
  }
}

  // NEW: Batch calculate multiple custom totals using RPC
  static async batchCalculateCustomTotals(
    configs: CustomTotalConfig[],
    agentId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<CustomTotalResult[]> {
    if (configs.length === 0) return []

    try {
      // Prepare configs for RPC
      const rpcConfigs = configs.map(config => ({
        id: config.id,
        aggregation: config.aggregation,
        column: config.column,
        jsonField: config.jsonField || null,
        filters: config.filters,
        filterLogic: config.filterLogic
      }))

      const { data, error } = await supabase
        .rpc('batch_calculate_custom_totals', {
          p_agent_id: agentId,
          p_configs: rpcConfigs,
          p_date_from: dateFrom || null,
          p_date_to: dateTo || null
        })

      if (error) {
        console.error('Error batch calculating custom totals:', error)
        // Return error results for all configs
        return configs.map(config => ({
          configId: config.id,
          value: 0,
          label: config.name,
          error: error.message
        }))
      }

      // Map results back to CustomTotalResult format
      return data.map((result: any) => {
        const config = configs.find(c => c.id === result.config_id)
        return {
          configId: result.config_id,
          value: result.result || 0,
          label: config?.name || 'Unknown',
          error: result.error_message || undefined
        }
      })
    } catch (error) {
      console.error('Error batch calculating custom totals:', error)
      return configs.map(config => ({
        configId: config.id,
        value: 0,
        label: config.name,
        error: 'Calculation failed'
      }))
    }
  }

  // NEW: Get distinct values for a column (useful for filter dropdowns)
  static async getDistinctValues(
    agentId: string,
    columnName: string,
    jsonField?: string,
    limit = 100
  ): Promise<Array<{ value: string; count: number }>> {
    try {
      const { data, error } = await supabase
        .rpc('get_distinct_values', {
          p_agent_id: agentId,
          p_column_name: columnName,
          p_json_field: jsonField || null,
          p_limit: limit
        })

      if (error) {
        console.error('Error getting distinct values:', error)
        return []
      }

      return data.map((row: any) => ({
        value: row.distinct_value,
        count: parseInt(row.count_occurrences)
      }))
    } catch (error) {
      console.error('Error getting distinct values:', error)
      return []
    }
  }

  // NEW: Get available JSON fields dynamically
  static async getAvailableJsonFields(
    agentId: string,
    columnName: string,
    limit = 50
  ): Promise<Array<{ fieldName: string; sampleValue: string; occurrences: number }>> {
    try {
      const { data, error } = await supabase
        .rpc('get_available_json_fields', {
          p_agent_id: agentId,
          p_column_name: columnName,
          p_limit: limit
        })

      if (error) {
        console.error('Error getting JSON fields:', error)
        return []
      }

      return data.map((row: any) => ({
        fieldName: row.field_name,
        sampleValue: row.sample_value,
        occurrences: parseInt(row.occurrences)
      }))
    } catch (error) {
      console.error('Error getting JSON fields:', error)
      return []
    }
  }

  // Delete custom total (unchanged)
  static async deleteCustomTotal(
    configId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('pype_voice_custom_totals_configs')
        .delete()
        .eq('id', configId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to delete custom total' }
    }
  }

  // Update custom total (unchanged)
  static async updateCustomTotal(
    configId: string,
    updates: Partial<CustomTotalConfig>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('pype_voice_custom_totals_configs')
        .update({
          name: updates.name,
          description: updates.description,
          aggregation: updates.aggregation,
          column_name: updates.column,
          json_field: updates.jsonField,
          filters: updates.filters,
          filter_logic: updates.filterLogic,
          icon: updates.icon,
          color: updates.color,
          updated_at: new Date().toISOString()
        })
        .eq('id', configId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to update custom total' }
    }
  }
}