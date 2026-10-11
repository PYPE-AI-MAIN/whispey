// One Ask Pi conversation embedded in a page (Call Logs, Prompt Forge): sends
// each question with that page's context, streams the reply, and keeps the
// chat session so follow-ups have the history.

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyEvent, classifyEvent, consumeSse, failAssistant, parseSseLine, type Message } from '@/lib/piStream'

export function usePiConversation({ projectId, getPageContext }: {
  projectId: string
  /** What the page shows right now; read when each question is sent. */
  getPageContext: () => unknown
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false)
  const sessionRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const contextRef = useRef(getPageContext)
  contextRef.current = getPageContext

  useEffect(() => () => abortRef.current?.abort(), [])

  const ask = useCallback(async (text: string) => {
    const message = text.trim()
    if (!message || busy) return
    setBusy(true)
    const assistantId = `a-${Date.now()}`
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: message, isFinal: true }, { id: assistantId, role: 'assistant', content: '', isFinal: false }])
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch('/api/pi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ message, projectId, sessionId: sessionRef.current, pageContext: contextRef.current() }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null)
        setMessages((m) => failAssistant(m, assistantId, err?.error ?? "Pi couldn't answer. Please try again."))
        return
      }
      await consumeSse(res.body, (line) => {
        const parsed = parseSseLine(line)
        if (!parsed) return
        const event = 'done' in parsed ? ({ kind: 'done' } as const) : classifyEvent(parsed.event, !!sessionRef.current)
        if (event.kind === 'session') {
          sessionRef.current = event.sessionId
          return
        }
        setMessages((m) => applyEvent(m, assistantId, event))
      })
      setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, isFinal: true } : x)))
    } catch (err: any) {
      if (err?.name !== 'AbortError') setMessages((m) => failAssistant(m, assistantId, "Pi couldn't answer. Please try again."))
    } finally {
      setBusy(false)
    }
  }, [busy, projectId])

  /** Starts a fresh chat (a new Pi session). */
  const reset = useCallback(() => {
    abortRef.current?.abort()
    sessionRef.current = null
    setMessages([])
    setBusy(false)
  }, [])

  return { messages, busy, ask, reset }
}
