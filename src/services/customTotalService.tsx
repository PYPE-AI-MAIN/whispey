// Mock Custom Total Service - No Database Required!

export interface CustomTotalConfig {
  id: string
  name: string
  aggregation: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX' | 'COUNT_DISTINCT'
  column: string
  jsonField?: string
  filters: any[]
  filterLogic: 'AND' | 'OR'
  icon?: string
  color?: string
  dateRange?: { from: string; to: string }
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CustomTotalResult {
  configId: string
  value: number | string
  label: string
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
      configId: config.id,
      value: 0,
      label: config.name
    }
  },

  async saveCustomTotal(config: Omit<CustomTotalConfig, 'id'>): Promise<CustomTotalConfig> {
    return {
      ...config,
      id: `custom_${Date.now()}`
    }
  },

  async updateCustomTotal(id: string, updates: Partial<CustomTotalConfig>): Promise<{ success: true }> {
    // Mock update – accept any update and return success
    return { success: true }
  },

  async deleteCustomTotal(id: string): Promise<boolean> {
    return true
  }
}