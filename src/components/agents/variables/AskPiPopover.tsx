'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { Pi, ArrowUp, X, Check, Loader2, AlertTriangle, RotateCcw } from 'lucide-react'

interface Anchor { left: number; top: number; bottom: number }
interface Msg {
  role: 'user' | 'assistant'
  content: string
  replacement?: string | null
  missingVars?: string[]
  streamingReplacement?: boolean
}

const PANEL_W = 360
const PANEL_MAX_H = 540
const MARGIN = 12
const MAX_HISTORY = 12
const MARK = '<<<REPLACEMENT>>>'
const CHIPS = [
  ['Shorter', 'Make it shorter'],
  ['More natural', 'Make it sound more natural for a phone call'],
  ['Hindi', 'Translate to Hindi'],
  ['Kannada', 'Translate to Kannada'],
]
const DECO = { inlineClassName: 'ask-pi-selection', stickiness: 1 } // 1 = never grows when typing at edges
const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", "Noto Sans Kannada", sans-serif'

const THEMES = {
  light: {
    panel: '#ffffff', border: '#e5e7eb', text: '#111827', muted: '#6b7280', surface: '#f9fafb',
    input: '#ffffff', card: '#f5f3ff', cardBorder: '#ddd6fe', warnBg: '#fffbeb', warnText: '#92400e',
    errBg: '#fef2f2', errText: '#b91c1c', chip: '#ffffff', shadow: '0 20px 50px -12px rgba(17,24,39,.35)',
  },
  dark: {
    panel: '#111827', border: '#374151', text: '#f3f4f6', muted: '#9ca3af', surface: '#1a2332',
    input: '#0b1220', card: 'rgba(124,58,237,.14)', cardBorder: 'rgba(167,139,250,.35)', warnBg: 'rgba(245,158,11,.12)', warnText: '#fcd34d',
    errBg: 'rgba(239,68,68,.12)', errText: '#fca5a5', chip: '#111827', shadow: '0 20px 50px -12px rgba(0,0,0,.7)',
  },
}
const ACCENT = '#7c3aed'
const GRADIENT = 'linear-gradient(135deg,#7c3aed,#4f46e5)'

const varsOf = (t: string) => new Set(t.match(/\{\{[^}]*\}\}/g) ?? [])

/** Selection -> "Ask Pi" button -> floating chat that rewrites the selected prompt text in place. */
export function AskPiPopover({ editor, fullPrompt }: { editor: any; fullPrompt: string }) {
  const { projectid } = useParams<{ projectid: string }>()
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [vp, setVp] = useState({ w: 1280, h: 800 })
  const [preview, setPreview] = useState('')
  const [ph, setPh] = useState(200)
  const panelRef = useRef<HTMLDivElement>(null)

  const decoRef = useRef<any>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const openRef = useRef(false)
  const fullPromptRef = useRef(fullPrompt)
  openRef.current = open
  fullPromptRef.current = fullPrompt
  const t = THEMES[isDark ? 'dark' : 'light']

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const mo = new MutationObserver(check)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    const size = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    size()
    window.addEventListener('resize', size)
    return () => { mo.disconnect(); window.removeEventListener('resize', size) }
  }, [])

  // Track the selection (debounced so dragging doesn't flicker the button) and keep the button glued to it on scroll.
  useEffect(() => {
    if (!editor) return
    let timer: any
    const update = () => {
      if (openRef.current) return
      const s = editor.getSelection()
      const model = editor.getModel()
      const text = s && !s.isEmpty() && model ? model.getValueInRange(s) : ''
      if (text.trim().length < 2) return setAnchor(null)
      const a = editor.getScrolledVisiblePosition(s.getStartPosition())
      const b = editor.getScrolledVisiblePosition(s.getEndPosition())
      const box = editor.getDomNode()?.getBoundingClientRect()
      if (!a || !b || !box || b.top < 0 || b.top > box.height - 6) return setAnchor(null)
      setAnchor({ left: box.left + b.left, top: box.top + Math.max(0, a.top), bottom: box.top + b.top + b.height })
    }
    const d1 = editor.onDidChangeCursorSelection(() => { clearTimeout(timer); timer = setTimeout(update, 150) })
    const d2 = editor.onDidScrollChange(update)
    const d3 = editor.onDidChangeModelContent(() => { if (!openRef.current) setAnchor(null) })
    window.addEventListener('resize', update)
    return () => { clearTimeout(timer); d1.dispose(); d2.dispose(); d3.dispose(); window.removeEventListener('resize', update) }
  }, [editor])

  useEffect(() => {
    const el = panelRef.current
    if (!open || !el) return
    const ro = new ResizeObserver(() => setPh(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => () => { abortRef.current?.abort(); decoRef.current?.clear() }, [])

  // Keep the newest message in view: top of Pi's reply (so a long suggestion starts at its first line), bottom otherwise.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const last = msgs[msgs.length - 1]
    const lastEl = el.lastElementChild as HTMLElement | null
    if (last?.role === 'assistant' && !busy && lastEl) el.scrollTo({ top: Math.max(0, lastEl.offsetTop - 12), behavior: 'smooth' })
    else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy, error])

  const currentRange = () => {
    const r = decoRef.current?.getRange(0)
    return r && !r.isEmpty() ? r : null
  }

  const openPanel = () => {
    const sel = editor.getSelection()
    if (!sel || sel.isEmpty()) return
    decoRef.current = editor.createDecorationsCollection([{ range: sel, options: DECO }])
    setPreview(editor.getModel().getValueInRange(sel).replace(/\s+/g, ' ').trim())
    setOpen(true)
  }

  const close = useCallback(() => {
    abortRef.current?.abort()
    decoRef.current?.clear()
    decoRef.current = null
    setOpen(false); setAnchor(null); setMsgs([]); setInput(''); setError(''); setBusy(false)
    editor?.focus()
  }, [editor])

  const send = async (override?: string, retry = false) => {
    const content = (override ?? input).trim()
    if (busy || (!retry && !content)) return
    const range = currentRange()
    if (!range) return setError('The selected text is no longer available. Close and select it again.')
    const selectedText = editor.getModel().getValueInRange(range)
    const next: Msg[] = retry ? msgs : [...msgs, { role: 'user', content }]
    if (!retry) { setMsgs(next); setInput(''); if (inputRef.current) inputRef.current.style.height = 'auto' }
    setError(''); setBusy(true)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch('/api/pi/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          projectId: projectid,
          selectedText,
          fullPrompt: fullPromptRef.current,
          messages: next.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content })),
        }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      // stream: "<short reply>\n<<<REPLACEMENT>>>\n<new text>" — show the reply as soon as it starts arriving
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let acc = ''
      const parse = (done: boolean): Msg => {
        const k = acc.indexOf(MARK)
        const content = (k < 0 ? acc : acc.slice(0, k)).trim()
        const rep = k < 0 ? '' : acc.slice(k + MARK.length).trim()
        const replacement = done && rep ? rep : null
        return {
          role: 'assistant', content, replacement,
          missingVars: replacement ? [...varsOf(selectedText)].filter(v => !replacement.includes(v)) : [],
          streamingReplacement: !done && k >= 0,
        }
      }
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        setMsgs([...next, parse(false)])
      }
      acc += dec.decode()
      if (!acc.trim()) throw new Error('Pi returned an empty response. Try again.')
      setMsgs([...next, parse(true)])
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      if (abortRef.current === ctrl) setBusy(false)
    }
  }

  const apply = (text: string) => {
    const range = currentRange()
    if (!range) return setError('The selected text is no longer available. Close and select it again.')
    editor.executeEdits('ask-pi', [{ range, text }])
    close()
  }

  if (!anchor && !open) return null
  if (typeof document === 'undefined') return null

  const a = anchor ?? { left: vp.w / 2, top: vp.h / 2, bottom: vp.h / 2 }
  const left = Math.max(MARGIN, Math.min(a.left, vp.w - Math.min(PANEL_W, vp.w - 2 * MARGIN) - MARGIN))
  // always next to the selection: just below it, sliding up only as far as needed to keep the whole panel on screen
  const maxH = Math.min(PANEL_MAX_H, vp.h - 2 * MARGIN)
  const panelTop = Math.max(MARGIN, Math.min(a.bottom + 8, vp.h - Math.min(ph, maxH) - MARGIN))
  const posStyle: React.CSSProperties = { top: panelTop, left }

  const lastIsError = !!error
  const canSend = !busy && !!input.trim()

  return createPortal(
    <div style={{ position: 'fixed', zIndex: 100, fontFamily: FONT, ...(open ? posStyle : { top: Math.min(a.bottom + 8, vp.h - 44), left }) }} onMouseDown={e => { if (!open) e.preventDefault() }}>
      <style>{`.ask-pi-selection{background:rgba(124,58,237,.28);border-radius:2px}`}</style>
      {!open ? (
        <button
          onClick={openPanel}
          style={{ background: GRADIENT, boxShadow: t.shadow }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-black/10 transition hover:brightness-110"
        >
          <Pi className="h-3.5 w-3.5" /> Ask Pi
        </button>
      ) : (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Ask Pi"
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}
          className="flex flex-col overflow-hidden rounded-2xl"
          style={{ width: Math.min(PANEL_W, vp.w - 2 * MARGIN), maxHeight: maxH, background: t.panel, color: t.text, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
        >
          <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${t.border}` }}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white" style={{ background: GRADIENT }}><Pi className="h-3.5 w-3.5" /></span>
            <p className="min-w-0 flex-1 truncate text-xs" style={{ color: t.muted }}>“{preview}”</p>
            <button onClick={close} aria-label="Close" className="rounded-md p-1 transition hover:opacity-70" style={{ color: t.muted }}><X className="h-4 w-4" /></button>
          </div>

          {(msgs.length > 0 || busy || error) && (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {msgs.map((m, i) => m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-3 py-1.5 text-sm leading-snug text-white" style={{ background: ACCENT }}>{m.content}</div>
                </div>
              ) : (
                <div key={i} className="space-y-2">
                  {m.content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ color: t.text }}>{m.content}</p>}
                  {m.streamingReplacement && <p className="flex items-center gap-2 text-xs" style={{ color: t.muted }}><Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing…</p>}
                  {m.replacement && (
                    <div className="overflow-hidden rounded-xl" style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}>
                      <p className="max-h-52 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-relaxed">{m.replacement}</p>
                      {!!m.missingVars?.length && (
                        <p className="flex items-start gap-1.5 px-3 py-2 text-xs" style={{ background: t.warnBg, color: t.warnText }}>
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>Drops {m.missingVars.join(', ')}. Check before applying.</span>
                        </p>
                      )}
                      <button
                        onClick={() => apply(m.replacement!)}
                        className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
                        style={{ background: ACCENT }}
                      >
                        <Check className="h-3.5 w-3.5" /> Apply
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {busy && msgs[msgs.length - 1]?.role !== 'assistant' && <div className="flex items-center gap-2 text-xs" style={{ color: t.muted }}><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</div>}
              {lastIsError && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: t.errBg, color: t.errText }}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 break-words">{error}</span>
                  {msgs[msgs.length - 1]?.role === 'user' && (
                    <button onClick={() => send(undefined, true)} className="flex shrink-0 items-center gap-1 font-semibold hover:underline"><RotateCcw className="h-3 w-3" />Retry</button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 p-3" style={{ borderTop: msgs.length || busy || error ? `1px solid ${t.border}` : undefined }}>
            {!msgs.length && !busy && (
              <div className="flex flex-wrap gap-1.5">
                {CHIPS.map(([label, ask]) => (
                  <button key={label} onClick={() => send(ask)} className="rounded-full px-2.5 py-0.5 text-xs transition hover:opacity-80" style={{ background: t.chip, border: `1px solid ${t.border}`, color: t.muted }}>{label}</button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-xl px-3 py-2 focus-within:ring-2" style={{ background: t.input, border: `1px solid ${t.border}`, ['--tw-ring-color' as any]: 'rgba(124,58,237,.35)' }}>
              <textarea
                ref={inputRef}
                autoFocus
                rows={1}
                value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px` }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
                placeholder="Tell Pi what to change…"
                maxLength={2000}
                className="max-h-24 flex-1 resize-none bg-transparent text-sm leading-snug outline-none placeholder:opacity-60"
                style={{ color: t.text, fontFamily: FONT }}
              />
              <button
                onClick={() => send()}
                disabled={!canSend}
                aria-label="Send"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition disabled:opacity-35"
                style={{ background: ACCENT }}
              ><ArrowUp className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
