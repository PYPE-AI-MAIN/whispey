import { useState, useCallback } from 'react'

export interface ConfigHistoryEntry {
  id: string
  version_number: number
  created_by_email: string | null
  created_at: string
}

export interface ConfigHistoryEntryDetail extends ConfigHistoryEntry {
  config_snapshot: any
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export function useConfigHistory(agentId: string) {
  const [entries, setEntries] = useState<ConfigHistoryEntry[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchHistory = useCallback(async (page = 1, limit = 20) => {
    if (!agentId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/history?page=${page}&limit=${limit}`)
      if (!res.ok) throw new Error('Failed to load history')
      const data = await res.json()
      setEntries(data.history ?? [])
      setPagination(data.pagination ?? null)
      setCurrentPage(page)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [agentId])

  const fetchEntryDetail = useCallback(async (entryId: string): Promise<{
    entry: ConfigHistoryEntryDetail
    previousEntry: ConfigHistoryEntryDetail | null
  } | null> => {
    if (!agentId) return null
    try {
      const res = await fetch(`/api/agents/${agentId}/history/${entryId}`)
      if (!res.ok) throw new Error('Failed to load entry')
      return await res.json()
    } catch {
      return null
    }
  }, [agentId])

  const goToPage = useCallback((page: number) => {
    fetchHistory(page)
  }, [fetchHistory])

  return {
    entries,
    pagination,
    isLoading,
    error,
    currentPage,
    fetchHistory,
    fetchEntryDetail,
    goToPage,
  }
}
