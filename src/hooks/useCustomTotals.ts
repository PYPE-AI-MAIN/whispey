// hooks/useCustomTotals.ts
import { useState, useEffect, useCallback } from 'react'
import { CustomTotalConfig, CustomTotalResult } from '../types/customTotals'

interface UseCustomTotalsOptions {
  projectId: string
  agentId: string
  dateFrom?: string
  dateTo?: string
  autoCalculate?: boolean
}

interface UseCustomTotalsReturn {
  configs: CustomTotalConfig[]
  results: CustomTotalResult[]
  loading: boolean
  calculating: boolean
  error: string | null
  loadConfigs: () => Promise<void>
  calculateResults: () => Promise<void>
  saveConfig: (config: CustomTotalConfig) => Promise<boolean>
  deleteConfig: (configId: string) => Promise<boolean>
  updateConfig: (configId: string, updates: Partial<CustomTotalConfig>) => Promise<boolean>
}

export const useCustomTotals = ({
  projectId,
  agentId,
  dateFrom,
  dateTo,
  autoCalculate = true
}: UseCustomTotalsOptions): UseCustomTotalsReturn => {
  const [configs, setConfigs] = useState<CustomTotalConfig[]>([])
  const [results, setResults] = useState<CustomTotalResult[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/custom-totals/${projectId}/${agentId}`)
      const json = (await res.json()) as { configs?: CustomTotalConfig[]; error?: string }
      if (!res.ok) {
        throw new Error(json.error || res.statusText)
      }
      setConfigs(json.configs || [])
    } catch (err) {
      setError('Failed to load custom totals')
      console.error('Error loading custom totals:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId, agentId])

  const calculateResults = useCallback(async () => {
    if (configs.length === 0) {
      setResults([])
      return
    }

    setCalculating(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/custom-totals/calculate/${projectId}/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configIds: configs.map((c) => c.id),
          dateFrom,
          dateTo,
        }),
      })
      const json = (await res.json()) as { results?: CustomTotalResult[]; error?: string }
      if (!res.ok) {
        throw new Error(json.error || res.statusText)
      }
      setResults(json.results || [])
    } catch (err) {
      setError('Failed to calculate custom totals')
      console.error('Error calculating custom totals:', err)
    } finally {
      setCalculating(false)
    }
  }, [configs, agentId, projectId, dateFrom, dateTo])

  const saveConfig = useCallback(async (config: CustomTotalConfig): Promise<boolean> => {
    try {
      const res = await fetch(`/api/custom-totals/${projectId}/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error || 'Failed to save configuration')
        return false
      }
      await loadConfigs()
      return true
    } catch (err) {
      setError('Failed to save configuration')
      console.error('Error saving custom total:', err)
      return false
    }
  }, [projectId, agentId, loadConfigs])

  const deleteConfig = useCallback(async (configId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/custom-totals/${configId}`, { method: 'DELETE' })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error || 'Failed to delete configuration')
        return false
      }
      await loadConfigs()
      return true
    } catch (err) {
      setError('Failed to delete configuration')
      console.error('Error deleting custom total:', err)
      return false
    }
  }, [loadConfigs])

  const updateConfig = useCallback(async (
    configId: string, 
    updates: Partial<CustomTotalConfig>
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/custom-totals/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) {
        setError(json.error || 'Failed to update configuration')
        return false
      }
      await loadConfigs()
      return true
    } catch (err) {
      setError('Failed to update configuration')
      console.error('Error updating custom total:', err)
      return false
    }
  }, [loadConfigs])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  useEffect(() => {
    if (autoCalculate && configs.length > 0) {
      calculateResults()
    }
  }, [autoCalculate, configs, calculateResults])

  return {
    configs,
    results,
    loading,
    calculating,
    error,
    loadConfigs,
    calculateResults,
    saveConfig,
    deleteConfig,
    updateConfig
  }
}
