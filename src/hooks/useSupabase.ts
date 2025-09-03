// hooks/useSupabase.ts - COMPLETE FIXED VERSION
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export const useInfiniteScroll = (table: string, options: any = {}) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialLoad, setInitialLoad] = useState(true)
  const offsetRef = useRef(0)
  const loadingRef = useRef(false) // Prevent concurrent requests
  
  // FIXED: Handle null options properly
  const safeOptions = options || {}
  const limit = safeOptions.limit || 50
  const shouldFetch = options !== null && options !== undefined

  // Memoize options to prevent unnecessary re-renders
  const optionsHash = JSON.stringify(safeOptions)

  const fetchData = useCallback(async (reset = false) => {
    // FIXED: Don't fetch if options is null (not ready)
    if (!shouldFetch) {
      setLoading(false)
      setInitialLoad(false)
      return
    }

    // Prevent concurrent requests
    if (loadingRef.current) return
    
    loadingRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      const offset = reset ? 0 : offsetRef.current
      
      let query = supabase
        .from(table)
        .select(safeOptions.select || '*') // FIXED: Use safeOptions
        .range(offset, offset + limit - 1)
      
      // Apply filters if provided
      if (safeOptions.filters) { // FIXED: Use safeOptions
        safeOptions.filters.forEach((filter: any) => {
          query = query.filter(filter.column, filter.operator, filter.value)
        })
      }
      
      // Apply ordering
      if (safeOptions.orderBy) { // FIXED: Use safeOptions
        query = query.order(safeOptions.orderBy.column, { ascending: safeOptions.orderBy.ascending })
      }
      
      const { data: newData, error } = await query
      
      if (error) throw error
      
      const fetchedData = newData || []
      
      if (reset) {
        setData(fetchedData)
        offsetRef.current = fetchedData.length
      } else {
        // Remove duplicates by checking existing IDs
        setData(prevData => {
          const existingIds = new Set(prevData.map(item => item.id))
          //@ts-ignore
          const uniqueNewData = fetchedData.filter(item => !existingIds.has(item.id))
          return [...prevData, ...uniqueNewData]
        })
        offsetRef.current += fetchedData.length
      }
      
      setHasMore(fetchedData.length === limit)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [table, optionsHash, limit, shouldFetch]) // FIXED: Add shouldFetch to deps

  const loadMore = useCallback(() => {
    if (!loadingRef.current && hasMore && !initialLoad && shouldFetch) { // FIXED: Add shouldFetch check
      fetchData(false)
    }
  }, [fetchData, hasMore, initialLoad, shouldFetch]) // FIXED: Add shouldFetch to deps

  const refresh = useCallback(() => {
    if (!shouldFetch) return // FIXED: Don't refresh if not ready
    
    offsetRef.current = 0
    setInitialLoad(true)
    fetchData(true).then(() => setInitialLoad(false))
  }, [fetchData, shouldFetch]) // FIXED: Add shouldFetch to deps

  // FIXED: Initial load only when ready
  useEffect(() => {
    if (initialLoad && shouldFetch) {
      fetchData(true).then(() => setInitialLoad(false))
    } else if (!shouldFetch) {
      // Reset state when not ready to fetch
      setData([])
      setLoading(false)
      setError(null)
      setHasMore(true)
      setInitialLoad(true)
      offsetRef.current = 0
    }
  }, [fetchData, initialLoad, shouldFetch])

  return { data, loading, hasMore, error, loadMore, refresh }
}

// Keep the existing useSupabaseQuery unchanged
export const useSupabaseQuery = (table: string, options: any = {}) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      let query = supabase
        .from(table)
        .select(options.select || '*')
      
      if (options.filters) {
        options.filters.forEach((filter: any) => {
          query = query.filter(filter.column, filter.operator, filter.value)
        })
      }
      
      if (options.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending })
      }
      
      if (options.limit) {
        query = query.limit(options.limit)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      
      setData(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [table, JSON.stringify(options)])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}