export interface CustomFilter {
    id: string
    column: string
    operation: string
    value: string
    jsonField?: string
    logicalOperator?: 'AND' | 'OR' // For connecting to next filter
  }
  
  export interface DistinctConfig {
    column: string // Base column (e.g., "metadata", "transcription_metrics")
    jsonField?: string // JSON field name (e.g., "patient_number")
  }

  export interface CustomTotalConfig {
    id: string
    name: string
    description?: string
    aggregation: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX' | 'COUNT_DISTINCT'
    column: string
    jsonField?: string // For JSONB fields
    distinct?: DistinctConfig // Configuration for counting distinct values of a different field
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