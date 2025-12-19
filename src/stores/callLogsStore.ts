import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FilterRule } from '@/components/CallFilter'

interface VisibleColumns {
  basic: string[]
  metadata: string[]
  transcription_metrics: string[]
  metrics: string[]
}

interface CallLogsState {
  // Filter state
  activeFilters: FilterRule[]
  setActiveFilters: (filters: FilterRule[]) => void
  
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

export const useCallLogsStore = create<CallLogsState>()(
  persist(
    (set) => ({
      // Filter state
      activeFilters: [],
      setActiveFilters: (filters) => set({ activeFilters: filters }),
      
      // Column visibility state
      visibleColumns: defaultVisibleColumns,
      setVisibleColumns: (columns) =>
        set((state) => ({
          visibleColumns: typeof columns === 'function' ? columns(state.visibleColumns) : columns
        })),
      
      // Reset state
      resetState: () => set({
        activeFilters: [],
        visibleColumns: defaultVisibleColumns
      })
    }),
    {
      name: 'call-logs-storage', // localStorage key
    }
  )
)
