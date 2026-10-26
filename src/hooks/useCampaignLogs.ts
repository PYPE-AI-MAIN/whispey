'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Campaign logs, one page of 100 at a time.
 *
 * The scheduler only offers cursor paging (no offset, no count, no search), so:
 *  - browsing walks the cursors and caches each page, which makes Prev instant;
 *  - searching pulls every page in the background (reusing cached ones) and
 *    filters in the browser, showing matches while it is still loading.
 * ponytail: search loads the whole campaign; add server-side search to the
 * contacts endpoint if campaigns grow past ~50k logs.
 */

export const LOGS_PAGE_SIZE = 100

type Page = { rows: any[]; nextKey: string | null }

function parseAdditional(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return {} }
  }
  return typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

const digitsOnly = (v: string) => v.replace(/\D/g, '')
// Looks like a phone number: digits with optional + spaces - . ( ), at least 3 digits.
const PHONE_LIKE = /^[\d\s+\-.()]+$/

/**
 * Case-insensitive "contains" match on the visible fields and every CSV
 * (additionalData) column. A phone-like query also matches by digits alone,
 * so "98318 81404", "98318-81404" and "+91 9831881404" all find +919831881404.
 */
export function logMatches(log: any, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const qDigits = PHONE_LIKE.test(q) ? digitsOnly(q) : ''
  const values: unknown[] = [log.name, log.phoneNumber, log.status, log.callResult, ...Object.values(parseAdditional(log.additionalData))]
  return values.some((v) => {
    if (typeof v !== 'string' && typeof v !== 'number') return false
    const text = String(v).toLowerCase()
    return text.includes(q) || (qDigits.length >= 3 && digitsOnly(text).includes(qDigits))
  })
}

async function fetchPage(campaignId: string, cursor: string | null): Promise<Page> {
  let url = `/api/campaigns/contacts?campaignId=${encodeURIComponent(campaignId)}&limit=${LOGS_PAGE_SIZE}`
  // The scheduler hands the cursor back already URL-encoded; pass it through as-is.
  if (cursor) url += `&lastKey=${cursor}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load logs')
  const data = await res.json()
  return { rows: data.contacts || [], nextKey: data.pagination?.hasMore ? data.pagination?.nextKey || null : null }
}

export function useCampaignLogs(campaignId: string, totalHint?: number) {
  // pages[i] is page i (0-based); its nextKey fetches page i + 1.
  const [pages, setPages] = useState<Page[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searchPage, setSearchPage] = useState(0)
  const [all, setAll] = useState<{ rows: any[]; done: boolean; failed?: boolean } | null>(null)

  // Bumped on refresh / campaign change so stale requests drop their results.
  const generation = useRef(0)
  const pagesRef = useRef<Page[]>([])
  pagesRef.current = pages

  const loadFirst = useCallback(async () => {
    const gen = ++generation.current
    setPages([]); setPage(0); setAll(null); setQuery(''); setSearchPage(0); setError(null); setLoading(true)
    try {
      const first = await fetchPage(campaignId, null)
      if (gen === generation.current) setPages([first])
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e.message : 'Failed to load logs')
    } finally {
      if (gen === generation.current) setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { loadFirst() }, [loadFirst])

  const next = useCallback(async () => {
    if (loading) return
    if (pagesRef.current[page + 1]) { setPage(page + 1); return }
    const cursor = pagesRef.current[page]?.nextKey
    if (!cursor) return
    const gen = generation.current
    setLoading(true)
    try {
      const fetched = await fetchPage(campaignId, cursor)
      if (gen !== generation.current) return
      if (fetched.rows.length === 0) {
        // The last page was exactly full: there is nothing after it after all.
        setPages((prev) => prev.map((p, i) => (i === page ? { ...p, nextKey: null } : p)))
        return
      }
      setPages((prev) => [...prev.slice(0, page + 1), fetched])
      setPage(page + 1)
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e.message : 'Failed to load logs')
    } finally {
      if (gen === generation.current) setLoading(false)
    }
  }, [campaignId, loading, page])

  const searching = query.trim().length > 0

  // Searching: walk every page once (cached ones first), appending as they arrive.
  useEffect(() => {
    if (!searching || all) return
    const gen = generation.current
    setAll({ rows: [], done: false })
    ;(async () => {
      const rows: any[] = []
      let cursor: string | null = null
      try {
        for (let i = 0; ; i++) {
          const cached: Page | undefined = pagesRef.current[i]
          const p: Page = cached ?? (await fetchPage(campaignId, cursor))
          if (gen !== generation.current) return
          rows.push(...p.rows)
          setAll({ rows: [...rows], done: false })
          if (!p.nextKey || p.rows.length === 0) break
          cursor = p.nextKey
        }
        if (gen === generation.current) setAll({ rows, done: true })
      } catch (e) {
        if (gen === generation.current) {
          setError(e instanceof Error ? e.message : 'Failed to load logs')
          setAll({ rows, done: true, failed: true })
        }
      }
    })()
  }, [searching, all, campaignId])

  const matches = useMemo(
    () => (searching && all ? all.rows.filter((log) => logMatches(log, query)) : []),
    [searching, all, query]
  )

  const updateQuery = useCallback((value: string) => {
    setQuery(value)
    setSearchPage(0)
    // A search that hit an error is dropped, so the next search reads every page again.
    setAll((prev) => (prev?.failed ? null : prev))
    setError(null)
  }, [])

  if (searching) {
    const pageCount = Math.max(1, Math.ceil(matches.length / LOGS_PAGE_SIZE))
    const current = Math.min(searchPage, pageCount - 1)
    return {
      rows: matches.slice(current * LOGS_PAGE_SIZE, (current + 1) * LOGS_PAGE_SIZE),
      page: current,
      pageCount,
      from: matches.length ? current * LOGS_PAGE_SIZE + 1 : 0,
      to: Math.min((current + 1) * LOGS_PAGE_SIZE, matches.length),
      total: matches.length,
      canPrev: current > 0,
      canNext: current < pageCount - 1,
      prev: () => setSearchPage(Math.max(0, current - 1)),
      next: () => setSearchPage(Math.min(pageCount - 1, current + 1)),
      first: () => setSearchPage(0),
      loading: !all?.done,
      searched: all?.rows.length ?? 0,
      error,
      query,
      setQuery: updateQuery,
      refresh: loadFirst,
      hasAnyLogs: true,
    }
  }

  const rows = pages[page]?.rows ?? []
  const known = pages.reduce((n, p) => n + p.rows.length, 0)
  const isLast = pages.length > 0 && !pages[pages.length - 1].nextKey
  // Total from the campaign stats, unless every page is loaded and says otherwise.
  const total = isLast ? known : Math.max(totalHint ?? 0, known)
  const from = rows.length ? page * LOGS_PAGE_SIZE + 1 : 0
  return {
    rows,
    page,
    pageCount: Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE)),
    from,
    to: from ? from + rows.length - 1 : 0,
    total,
    canPrev: page > 0,
    canNext: Boolean(pages[page]?.nextKey) || Boolean(pages[page + 1]),
    prev: () => setPage((p) => Math.max(0, p - 1)),
    next,
    first: () => setPage(0),
    loading,
    searched: 0,
    error,
    query,
    setQuery: updateQuery,
    refresh: loadFirst,
    hasAnyLogs: (pages[0]?.rows.length ?? 0) > 0,
  }
}
