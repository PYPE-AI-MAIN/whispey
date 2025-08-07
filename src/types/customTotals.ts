export interface CustomFilter {
    id: string
    column: string
    operation: string
    value: string
    jsonField?: string
    logicalOperator?: 'AND' | 'OR' // For connecting to next filter
  }
  
  export interface CustomTotalConfig {
    id: string
    name: string
    description?: string
    aggregation: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX' | 'COUNT_DISTINCT'
    column: string
    jsonField?: string // For JSONB fields
    filters: CustomFilter[]
    filterLogic: 'AND' | 'OR' // Overall logic between filter groups
    icon?: string
    color?: string
    dateRange?: {
      from: string
      to: string
    }
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