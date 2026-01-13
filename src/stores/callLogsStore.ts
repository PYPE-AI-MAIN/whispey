import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FilterRule } from '@/components/CallFilter'

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
  // Filter state
  activeFilters: FilterRule[]
  setActiveFilters: (filters: FilterRule[]) => void
  
  // Distinct configuration
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

// Helper function to validate and clean filters (backward compatibility)
const validateAndCleanFilters = (filters: FilterRule[]): FilterRule[] => {
  return filters.filter(filter => {
    // If it's a JSONB column (metadata or transcription_metrics)
    if (filter.column === 'metadata' || filter.column === 'transcription_metrics') {
      // For JSONB operations, jsonField is required
      const jsonbOperations = ['json_equals', 'json_contains', 'json_greater_than', 'json_less_than', 'json_exists']
      if (jsonbOperations.includes(filter.operation)) {
        // If jsonField is missing, this is an invalid filter - remove it
        if (!filter.jsonField) {
          console.warn(`Removing invalid filter: ${filter.column} with operation ${filter.operation} missing jsonField`)
          return false
        }
      }
    }
    return true
  })
}

export const useCallLogsStore = create<CallLogsState>()(
  persist(
    (set, get) => ({
      // Filter state
      activeFilters: [],
      setActiveFilters: (filters) => {
        // Clean invalid filters before setting
        const cleanedFilters = validateAndCleanFilters(filters)
        set({ activeFilters: cleanedFilters })
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
      // Clean filters when loading from localStorage
      onRehydrateStorage: (state) => {
        if (state) {
          const cleanedFilters = validateAndCleanFilters(state.activeFilters)
          if (cleanedFilters.length !== state.activeFilters.length) {
            // Some filters were removed, update the store
            state.setActiveFilters(cleanedFilters)
          }
        }
      }
    }
  )
)
