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
  // Per-agent filter state — each agent has its own independent slot
  filtersByAgent: Record<string, FilterOperation[]>
  setFiltersForAgent: (agentId: string, operations: FilterOperation[]) => void

  // Per-agent distinct config (legacy compat — kept so CallFilter prop still works)
  distinctConfigByAgent: Record<string, DistinctConfig | undefined>
  setDistinctConfigForAgent: (agentId: string, config: DistinctConfig | undefined) => void

  // Per-agent current page — persisted so navigating away and back restores position
  pageByAgent: Record<string, number>
  setPageForAgent: (agentId: string, page: number) => void

  // Column visibility — intentionally global (shared across agents, user preference)
  visibleColumns: VisibleColumns
  setVisibleColumns: (columns: VisibleColumns | ((prev: VisibleColumns) => VisibleColumns)) => void

  // Clears all filter state (column prefs preserved)
  resetState: () => void
}

const defaultVisibleColumns: VisibleColumns = {
  basic: [],
  metadata: [],
  transcription_metrics: [],
  metrics: []
}

const validateAndCleanOperations = (operations: FilterOperation[]): FilterOperation[] => {
  const valid = operations.filter(op => {
    if (op.type === 'filter') {
      if (op.column === 'metadata' || op.column === 'transcription_metrics') {
        const jsonbOps = ['json_equals', 'json_not_equals', 'json_contains', 'json_greater_than', 'json_less_than', 'json_exists']
        if (jsonbOps.includes(op.operation) && !op.jsonField) {
          console.warn(`Removing invalid filter: ${op.column}.${op.operation} missing jsonField`)
          return false
        }
      }
    } else if (op.type === 'distinct') {
      if ((op.column === 'metadata' || op.column === 'transcription_metrics') && !op.jsonField) {
        console.warn(`Removing invalid distinct: ${op.column} missing jsonField`)
        return false
      }
    }
    return true
  })
  return valid.map((op, index) => ({
    ...op,
    order: op.order !== undefined ? op.order : index
  }))
}

export const useCallLogsStore = create<CallLogsState>()(
  persist(
    (set) => ({
      filtersByAgent: {},
      setFiltersForAgent: (agentId, operations) =>
        set((state) => ({
          filtersByAgent: {
            ...state.filtersByAgent,
            [agentId]: validateAndCleanOperations(operations)
          }
        })),

      distinctConfigByAgent: {},
      setDistinctConfigForAgent: (agentId, config) =>
        set((state) => ({
          distinctConfigByAgent: { ...state.distinctConfigByAgent, [agentId]: config }
        })),

      pageByAgent: {},
      setPageForAgent: (agentId, page) =>
        set((state) => ({
          pageByAgent: { ...state.pageByAgent, [agentId]: page }
        })),

      visibleColumns: defaultVisibleColumns,
      setVisibleColumns: (columns) =>
        set((state) => ({
          visibleColumns: typeof columns === 'function' ? columns(state.visibleColumns) : columns
        })),

      resetState: () =>
        set({ filtersByAgent: {}, distinctConfigByAgent: {}, pageByAgent: {} })
    }),
    {
      name: 'call-logs-storage',
      version: 2, // bumped: added pageByAgent
      // Runs when stored version < current version.
      // v0/v1 had no pageByAgent — preserve everything else.
      migrate: (old: any) => ({
        filtersByAgent: old?.filtersByAgent ?? {},
        distinctConfigByAgent: old?.distinctConfigByAgent ?? {},
        pageByAgent: {},
        visibleColumns: old?.visibleColumns ?? defaultVisibleColumns
      }),
      // Runs after rehydration — clean any invalid filters that slipped through.
      onRehydrateStorage: () => (state) => {
        if (!state?.filtersByAgent) return
        for (const [agentId, filters] of Object.entries(state.filtersByAgent)) {
          const cleaned = validateAndCleanOperations(filters as FilterOperation[])
          if (cleaned.length !== (filters as FilterOperation[]).length) {
            state.setFiltersForAgent(agentId, cleaned)
          }
        }
      }
    }
  )
)
