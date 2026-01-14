import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FilterOperation } from '@/components/CallFilter'

interface VisibleColumns {
  basic: string[]
  metadata: string[]
  transcription_metrics: string[]
  metrics: string[]
}

export interface DistinctConfig {
  column: string
  jsonField?: string
  order: 'asc' | 'desc'
}

interface CallLogsState {
  // Filter operations (unified filters and distinct)
  activeFilters: FilterOperation[]
  setActiveFilters: (operations: FilterOperation[]) => void
  
  // Legacy distinct configuration (for backward compatibility)
  distinctConfig?: DistinctConfig
  setDistinctConfig: (config?: DistinctConfig) => void
  
  // Column visibility state
  visibleColumns: VisibleColumns
  setVisibleColumns: (columns: VisibleColumns | ((prev: VisibleColumns) => VisibleColumns)) => void
  
  // Reset all state
  resetState: () => void
}

const defaultVisibleColumns: VisibleColumns = {
  basic: [],
  metadata: [],
  transcription_metrics: [],
  metrics: []
}

// Helper function to validate and clean filter operations
const validateAndCleanOperations = (operations: FilterOperation[]): FilterOperation[] => {
  const validOperations = operations.filter(op => {
    if (op.type === 'filter') {
      // If it's a JSONB column (metadata or transcription_metrics)
      if (op.column === 'metadata' || op.column === 'transcription_metrics') {
        // For JSONB operations, jsonField is required
        const jsonbOperations = ['json_equals', 'json_contains', 'json_greater_than', 'json_less_than', 'json_exists']
        if (jsonbOperations.includes(op.operation)) {
          // If jsonField is missing, this is an invalid filter - remove it
          if (!op.jsonField) {
            console.warn(`Removing invalid filter: ${op.column} with operation ${op.operation} missing jsonField`)
            return false
          }
        }
      }
    } else if (op.type === 'distinct') {
      // Validate distinct operations
      if (op.column === 'metadata' || op.column === 'transcription_metrics') {
        if (!op.jsonField) {
          console.warn(`Removing invalid distinct operation: ${op.column} missing jsonField`)
          return false
        }
      }
    }
    return true
  })
  
  // Ensure all operations have order
  return validOperations.map((op, index) => ({
    ...op,
    order: op.order !== undefined ? op.order : index
  }))
}

export const useCallLogsStore = create<CallLogsState>()(
  persist(
    (set, get) => ({
      // Filter operations state
      activeFilters: [],
      setActiveFilters: (operations) => {
        // Clean invalid operations before setting
        const cleanedOperations = validateAndCleanOperations(operations)
        set({ activeFilters: cleanedOperations })
      },
      
      // Distinct configuration
      distinctConfig: undefined,
      setDistinctConfig: (config) => set({ distinctConfig: config }),
      
      // Column visibility state
      visibleColumns: defaultVisibleColumns,
      setVisibleColumns: (columns) =>
        set((state) => ({
          visibleColumns: typeof columns === 'function' ? columns(state.visibleColumns) : columns
        })),
      
      // Reset state
      resetState: () => set({
        activeFilters: [],
        distinctConfig: undefined,
        visibleColumns: defaultVisibleColumns
      })
    }),
    {
      name: 'call-logs-storage', // localStorage key
      // Clean operations when loading from localStorage
      onRehydrateStorage: (state) => {
        if (state) {
          // Migrate legacy FilterRule[] to FilterOperation[] if needed
          const operations = state.activeFilters.map((op: any) => {
            // If it's a legacy FilterRule (has 'operation' field but no 'type'), convert it
            if (op.operation && !op.type) {
              return {
                id: op.id,
                type: 'filter' as const,
                column: op.column,
                operation: op.operation,
                value: op.value,
                jsonField: op.jsonField,
                order: op.order ?? 0
              }
            }
            return op
          })
          
          const cleanedOperations = validateAndCleanOperations(operations)
          if (cleanedOperations.length !== operations.length) {
            // Some operations were removed, update the store
            state.setActiveFilters(cleanedOperations)
          }
        }
      }
    }
  )
)
