'use client'

// The one floating Ask Pi (FloatingPi) is mounted once per project; pages tell it
// what they are showing. A page that only wants Pi to see its state calls
// usePiSurface. A page that has its own kind of chat (Call Logs filters, workflow
// edits, dashboard charts) renders it inside <PiDockBody>, which puts it in the box.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface PiSurface {
  /** Header chip, e.g. "25 calls · 7D". */
  label?: string
  /** The page's own starter questions. */
  suggestions?: { label: string; prompt: string }[]
  /** Page state sent with every message (selected chart, open node …); read at send time. */
  getDetails?: () => Record<string, unknown> | null
  /** Replaces the whole page context the server gets (Prompt Forge sends its draft this way); read at send time. */
  getContext?: () => unknown
  /** Applies a find-and-replace Pi suggested to the page's prompt (Prompt Forge). */
  applyPromptEdit?: (find: string, replace: string) => PromptEditResult
}

/** What applying a suggested prompt edit did. */
export type PromptEditResult = { ok: true } | { ok: false; reason: string }

type Getters = Pick<PiSurface, 'getDetails' | 'getContext' | 'applyPromptEdit'>

interface PiDock {
  surface: Pick<PiSurface, 'label' | 'suggestions'> | null
  setSurface: (s: Pick<PiSurface, 'label' | 'suggestions'> | null) => void
  gettersRef: MutableRefObject<Getters>
  slot: HTMLElement | null
  setSlot: (el: HTMLElement | null) => void
  /** How many pages are rendering their own chat into the box. */
  customCount: number
  setCustomCount: (f: (n: number) => number) => void
  /** Tab name for the page's own chat, when it wants a tab next to plain Ask Pi. */
  customLabel: string | null
  setCustomLabel: (label: string | null) => void
  open: boolean
  setOpen: (open: boolean) => void
  max: boolean
  setMax: (max: boolean) => void
}

const Ctx = createContext<PiDock | null>(null)

export function PiDockProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [surface, setSurface] = useState<PiDock['surface']>(null)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [customCount, setCustomCount] = useState(0)
  const [customLabel, setCustomLabel] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [max, setMax] = useState(false)
  const gettersRef = useRef<Getters>({})
  const value = useMemo(
    () => ({ surface, setSurface, gettersRef, slot, setSlot, customCount, setCustomCount, customLabel, setCustomLabel, open, setOpen, max, setMax }),
    [surface, slot, customCount, customLabel, open, max],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const usePiDock = () => useContext(Ctx)

/** Tell the floating Pi what this page is showing. Safe outside the provider (does nothing). */
export function usePiSurface(s: PiSurface | null) {
  const dock = usePiDock()
  const sig = s ? JSON.stringify([s.label, s.suggestions]) : ''
  const latest = useRef(s)
  latest.current = s

  useEffect(() => {
    if (!dock || !latest.current) return
    dock.gettersRef.current = {
      getDetails: () => latest.current?.getDetails?.() ?? null,
      getContext: latest.current.getContext ? () => latest.current?.getContext?.() : undefined,
      applyPromptEdit: latest.current.applyPromptEdit
        ? (find, replace) => latest.current?.applyPromptEdit?.(find, replace) ?? { ok: false, reason: 'Nothing to edit here' }
        : undefined,
    }
    dock.setSurface({ label: latest.current.label, suggestions: latest.current.suggestions })
    return () => {
      dock.gettersRef.current = {}
      dock.setSurface(null)
    }
    // sig stands for label + suggestions; the getters are read through `latest`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dock?.setSurface, sig])
}

/** A page's own chat, drawn inside the floating box in place of the default one. */
export function PiDockBody({ label, children }: Readonly<{ label?: string; children: ReactNode }>) {
  const dock = usePiDock()
  const setCustomCount = dock?.setCustomCount
  const setCustomLabel = dock?.setCustomLabel
  useEffect(() => {
    setCustomCount?.((n) => n + 1)
    setCustomLabel?.(label ?? null)
    return () => {
      setCustomCount?.((n) => n - 1)
      setCustomLabel?.(null)
    }
  }, [setCustomCount, setCustomLabel, label])
  if (!dock?.slot) return null
  return createPortal(children, dock.slot)
}
