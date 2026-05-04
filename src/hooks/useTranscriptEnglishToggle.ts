'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

export type TranscriptTurn = {
  user_transcript?: string
  agent_response?: string
}

function collectUniqueTexts(traces: TranscriptTurn[]): string[] {
  const set = new Set<string>()
  for (const t of traces) {
    const u = t.user_transcript
    const a = t.agent_response
    if (typeof u === 'string' && u.trim()) set.add(u)
    if (typeof a === 'string' && a.trim()) set.add(a)
  }
  return [...set]
}

export function useTranscriptEnglishToggle(traces: TranscriptTurn[]) {
  const [viewEnglish, setViewEnglish] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const cacheRef = useRef<Map<string, string>>(new Map())
  const [cacheVersion, setCacheVersion] = useState(0)

  const fingerprint = useMemo(
    () => collectUniqueTexts(traces).sort().join('\u0001'),
    [traces],
  )

  useEffect(() => {
    if (!viewEnglish) return

    const uncached = collectUniqueTexts(traces).filter((s) => !cacheRef.current.has(s))
    if (uncached.length === 0) return

    let cancelled = false
    ;(async () => {
      setIsTranslating(true)
      try {
        const res = await fetch('/api/translate/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: uncached }),
        })
        const data = (await res.json().catch(() => ({}))) as { translations?: string[]; error?: string }
        if (!res.ok) {
          throw new Error(data.error || `Translation failed (${res.status})`)
        }
        const translations = data.translations
        if (!Array.isArray(translations) || translations.length !== uncached.length) {
          throw new Error('Unexpected translation response')
        }
        uncached.forEach((orig, i) => {
          cacheRef.current.set(orig, translations[i] ?? orig)
        })
        if (!cancelled) setCacheVersion((v) => v + 1)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Translation failed'
        toast.error(msg)
        if (!cancelled) setViewEnglish(false)
      } finally {
        if (!cancelled) setIsTranslating(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [viewEnglish, fingerprint])

  const formatTranscript = useCallback(
    (s: string | undefined | null) => {
      if (s == null || s === '') return ''
      if (!viewEnglish) return s
      return cacheRef.current.get(s) ?? s
    },
    [viewEnglish, cacheVersion],
  )

  return { viewEnglish, setViewEnglish, isTranslating, formatTranscript }
}
