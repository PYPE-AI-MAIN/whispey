// hooks/useSupabase.ts - FIXED VERSION
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
  const limit = options.limit || 50


  // Memoize options to prevent unnecessary re-renders
  const optionsHash = JSON.stringify(options)

  const fetchData = useCallback(async (reset = false) => {
    // Prevent concurrent requests
    if (loadingRef.current) return
    
    loadingRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      const offset = reset ? 0 : offsetRef.current
      
      let query = supabase
        .from(table)
        .select(options.select || '*')
        .range(offset, offset + limit - 1)
      
      // Apply filters if provided
      if (options.filters) {
        options.filters.forEach((filter: any) => {
          query = query.filter(filter.column, filter.operator, filter.value)
        })
      }
      
      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending })
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
  }, [table, optionsHash, limit])

  const loadMore = useCallback(() => {
    if (!loadingRef.current && hasMore && !initialLoad) {
      fetchData(false)
    }
  }, [fetchData, hasMore, initialLoad])

  const refresh = useCallback(() => {
    offsetRef.current = 0
    setInitialLoad(true)
    fetchData(true).then(() => setInitialLoad(false))
  }, [fetchData])

  // Initial load
  useEffect(() => {
    if (initialLoad) {
      fetchData(true).then(() => setInitialLoad(false))
    }
  }, [fetchData, initialLoad])

  return { data, loading, hasMore, error, loadMore, refresh }
}

// Alternative: Simple query hook without infinite scroll
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