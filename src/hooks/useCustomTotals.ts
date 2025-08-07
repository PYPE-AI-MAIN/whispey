// hooks/useCustomTotals.ts
import { useState, useEffect, useCallback } from 'react'
import { CustomTotalsService } from '../services/customTotalService'
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

  // Load configurations from database
  const loadConfigs = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const loadedConfigs = await CustomTotalsService.getCustomTotals(projectId, agentId)
      setConfigs(loadedConfigs)
    } catch (err) {
      setError('Failed to load custom totals')
      console.error('Error loading custom totals:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId, agentId])

  // Calculate results for all configurations
  const calculateResults = useCallback(async () => {
    if (configs.length === 0) {
      setResults([])
      return
    }

    setCalculating(true)
    setError(null)
    
    try {
      const calculatedResults = await Promise.all(
        configs.map(config => 
          CustomTotalsService.calculateCustomTotal(config, agentId, dateFrom, dateTo)
        )
      )
      setResults(calculatedResults)
    } catch (err) {
      setError('Failed to calculate custom totals')
      console.error('Error calculating custom totals:', err)
    } finally {
      setCalculating(false)
    }
  }, [configs, agentId, dateFrom, dateTo])

  // Save new configuration
  const saveConfig = useCallback(async (config: CustomTotalConfig): Promise<boolean> => {
    try {
      const result = await CustomTotalsService.saveCustomTotal(config, projectId, agentId)
      if (result.success) {
        await loadConfigs() // Refresh configurations
        return true
      } else {
        setError(result.error || 'Failed to save configuration')
        return false
      }
    } catch (err) {
      setError('Failed to save configuration')
      console.error('Error saving custom total:', err)
      return false
    }
  }, [projectId, agentId, loadConfigs])

  // Delete configuration
  const deleteConfig = useCallback(async (configId: string): Promise<boolean> => {
    try {
      const result = await CustomTotalsService.deleteCustomTotal(configId)
      if (result.success) {
        await loadConfigs() // Refresh configurations
        return true
      } else {
        setError(result.error || 'Failed to delete configuration')
        return false
      }
    } catch (err) {
      setError('Failed to delete configuration')
      console.error('Error deleting custom total:', err)
      return false
    }
  }, [loadConfigs])

  // Update configuration
  const updateConfig = useCallback(async (
    configId: string, 
    updates: Partial<CustomTotalConfig>
  ): Promise<boolean> => {
    try {
      const result = await CustomTotalsService.updateCustomTotal(configId, updates)
      if (result.success) {
        await loadConfigs() // Refresh configurations
        return true
      } else {
        setError(result.error || 'Failed to update configuration')
        return false
      }
    } catch (err) {
      setError('Failed to update configuration')
      console.error('Error updating custom total:', err)
      return false
    }
  }, [loadConfigs])

  // Load configurations on mount
  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  // Auto-calculate when configurations or date range changes
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