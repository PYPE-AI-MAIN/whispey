// Mock Custom Total Service - No Database Required!

export interface CustomTotalConfig {
  id: string
  name: string
  aggregation: string
  column_name: string
  json_field?: string
  filters: any[]
  filter_logic: string
}

export interface CustomTotalResult {
  id: string
  name: string
  value: number
  error?: string
}

export const CustomTotalsService = {
  // Mock implementation - returns empty arrays
  async getCustomTotals(projectId: string, agentId?: string): Promise<CustomTotalConfig[]> {
    return []
  },

  async calculateCustomTotal(
    config: CustomTotalConfig, 
    agentId: string, 
    dateFrom: string, 
    dateTo: string
  ): Promise<CustomTotalResult> {
    return {
      id: config.id,
      name: config.name,
      value: 0
    }
  },

  async saveCustomTotal(config: Omit<CustomTotalConfig, 'id'>): Promise<CustomTotalConfig> {
    return {
      ...config,
      id: `custom_${Date.now()}`
    }
  },

  async deleteCustomTotal(id: string): Promise<boolean> {
    return true
  }
}