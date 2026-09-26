/**
 * "Generate with AI" — a chat, not a one-shot generate box, so a vague first
 * try can be refined ("make it a pie instead", "last 7 days not 30") instead
 * of retyping the whole request. Structurally this mirrors `WorkflowChat` —
 * bubbles, streaming, a self-correction retry — the app's other "AI Builder".
 *
 * The model only ever proposes; a chart never reaches Apply until
 * `validateAiChart` (`aiChartSpec.ts`) has re-checked it against `Spec` in the
 * browser, the same way `WorkflowChat` validates before calling `setWorkflow`.
 */
'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp, BarChart3, Hash, LineChart as LineIcon, Loader2, PieChart as PieIcon,
  RotateCcw, Sparkles, Table2, User, X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { CatalogField, ChartKind } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'
import type { OutcomeRanking } from './OutcomeOrderEditor'
import { explainSpec } from './explain'
import { type AiChart, extractChartJson, stripJsonBlocksForHistory, validateAiChart } from './aiChartSpec'

const KIND_ICON: Record<ChartKind, React.ReactNode> = {
  kpi: <Hash className="h-4 w-4" />,
  bar: <BarChart3 className="h-4 w-4" />,
  line: <LineIcon className="h-4 w-4" />,
  pie: <PieIcon className="h-4 w-4" />,
  table: <Table2 className="h-4 w-4" />,
  text: <Hash className="h-4 w-4" />,
  formula: <Hash className="h-4 w-4" />,
}

const SUGGESTIONS = [
  'Wrong number rate as a number card',
  'Bar chart of calls by why they ended, last 30 days',
  'Pie chart of outcomes this week',
]

type ChartStatus = 'ok' | 'error' | 'none'
interface Message {
  role: 'user' | 'assistant'
  content: string
  chartStatus?: ChartStatus
  chartError?: string
}

/** A silence-only timeout — resets on every chunk received, so it only fires when the stream truly stalls. */
const SILENCE_TIMEOUT_MS = 60_000

function applySSELine(line: string, state: { content: string; truncated: boolean }, onChunk: (content: string) => void) {
  if (!line.startsWith('data: ')) return
  const data = line.slice(6).trim()
  if (data === '[DONE]') return
  try {
    const parsed = JSON.parse(data)
    if (parsed.error) throw new Error(parsed.error)
    if (parsed.truncated) state.truncated = true
    if (parsed.content) {
      state.content += parsed.content
      onChunk(state.content)
    }
  } catch (e) {
    if (e instanceof Error && e.message && !e.message.includes('Unexpected')) throw e
  }
}

async function streamAssistantReply(res: Response, abort: AbortController, onChunk: (content: string) => void) {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response stream')

  const decoder = new TextDecoder()
  const state = { content: '', truncated: false }
  let buffer = ''

  while (true) {
    const { done, value } = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => setTimeout(() => {
        abort.abort()
        reject(new Error('Response timed out — try a shorter request'))
      }, SILENCE_TIMEOUT_MS)),
    ])
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) applySSELine(line, state, onChunk)
  }
  return { assistantContent: state.content, wasTruncated: state.truncated }
}

export function AiChartBuilderDialog({
  agentId, fields, ranking, canEdit, onAdd,
}: Readonly<{
  agentId: string
  fields: CatalogField[]
  ranking?: OutcomeRanking
  canEdit: boolean
  onAdd: (title: string, kind: ChartKind, spec: SpecInput) => void
}>) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [draft, setDraft] = useState<AiChart | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    setDraft(null)
    setIsStreaming(false)
  }, [])

  // One request/stream/validate round-trip. Appends a fresh assistant bubble
  // and fills it as chunks arrive; returns whether the chart it contained (if
  // any) was valid, so the caller can decide whether to retry once.
  const sendAndValidate = useCallback(
    async (conversation: Message[], currentDraft: AiChart | null, abort: AbortController, opts: { silentOnError?: boolean } = {}) => {
      const { silentOnError = false } = opts
      const res = await fetch('/api/analytics/ai-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          messages: conversation.map((m) => ({
            role: m.role,
            content: m.role === 'assistant' ? stripJsonBlocksForHistory(m.content) : m.content,
          })),
          fields,
          ranking: ranking ?? null,
          currentChart: currentDraft,
        }),
        signal: abort.signal,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Request failed (${res.status})`)
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
      const { assistantContent, wasTruncated } = await streamAssistantReply(res, abort, (content) => {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content }
          return updated
        })
      })

      if (wasTruncated) {
        const err = 'Response was cut off — try a shorter or simpler request.'
        if (!silentOnError) toast.error(err, { duration: 8000 })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated.at(-1)!, chartStatus: 'error', chartError: err }
          return updated
        })
        return { status: 'error' as const, error: err, retryable: false }
      }

      const candidate = extractChartJson(assistantContent)
      if (!candidate) {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated.at(-1)!, chartStatus: 'none' }
          return updated
        })
        return { status: 'none' as const, retryable: false }
      }

      const result = validateAiChart(candidate, fields)
      if (!result.ok) {
        if (!silentOnError) toast.error(`Couldn't build that chart: ${result.error}`, { duration: 8000 })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated.at(-1)!, chartStatus: 'error', chartError: result.error }
          return updated
        })
        return { status: 'error' as const, error: result.error, retryable: true }
      }

      setDraft(result.chart)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated.at(-1)!, chartStatus: 'ok' }
        return updated
      })
      return { status: 'ok' as const, retryable: false }
    },
    [agentId, fields, ranking]
  )

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim()
      if (!text || isStreaming) return

      const userMsg: Message = { role: 'user', content: text }
      let conversation = [...messages, userMsg]
      setMessages(conversation)
      setInput('')
      setIsStreaming(true)

      const abort = new AbortController()
      abortRef.current = abort

      try {
        const first = await sendAndValidate(conversation, draft, abort, { silentOnError: true })

        if (first.retryable) {
          const retryMsg: Message = {
            role: 'user',
            content: `The chart you just returned failed validation: ${first.error}. Fix this and return the corrected COMPLETE chart.`,
          }
          conversation = [...conversation, { role: 'assistant', content: '(previous attempt — see error below)' }, retryMsg]
          setMessages((prev) => [...prev, retryMsg])
          await sendAndValidate(conversation, draft, abort, { silentOnError: false })
        } else if (first.status === 'error' && first.error) {
          toast.error(first.error, { duration: 8000 })
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        toast.error(err instanceof Error ? err.message : 'Chat request failed')
        setMessages((prev) => (prev.length && prev.at(-1)?.role === 'assistant' && !prev.at(-1)?.content ? prev.slice(0, -1) : prev))
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [input, isStreaming, messages, draft, sendAndValidate]
  )

  const apply = () => {
    if (!draft) return
    onAdd(draft.title, draft.kind, draft.spec)
    toast.success(`Added "${draft.title}" to the dashboard`)
    setOpen(false)
    reset()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  if (!canEdit) return null

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="mb-3 w-full justify-center gap-1.5 border-dashed border-blue-300 text-blue-700 hover:border-blue-400 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
      >
        <Sparkles className="h-3.5 w-3.5" /> Generate with AI
      </Button>

      {/* The default close X is absolutely positioned top-4 right-4 — the same
          corner "Start over" sits in, so the two rendered on top of each
          other. Disable it here and draw one explicit close button instead,
          in flow with the rest of the header rather than fighting it for a
          fixed corner. */}
      <DialogContent showCloseButton={false} className="flex h-[80vh] max-w-lg flex-col gap-0 rounded-2xl p-0 shadow-2xl">
        <DialogHeader className="flex-shrink-0 flex-row items-center gap-1 space-y-0 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <DialogTitle className="text-sm font-semibold text-foreground">AI Chart Builder</DialogTitle>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              Chat to build or refine a chart from this agent&apos;s real fields
            </p>
          </div>
          {messages.length > 0 && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={reset} title="Start over">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Close">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-2 py-1">
              <p className="px-0.5 text-[11px] text-muted-foreground">Try one of these, or describe your own:</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void handleSend(s)}
                  className="w-full rounded-lg bg-muted px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={`${msg.role}-${i}`} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/40">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted text-foreground'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <AssistantBubble
                    content={msg.content}
                    streaming={isStreaming && i === messages.length - 1}
                    chartStatus={msg.chartStatus}
                    chartError={msg.chartError}
                  />
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/40">
                  <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
            </div>
          ))}
        </div>

        {draft && (
          <div className="flex flex-shrink-0 items-center gap-2 border-t border-border bg-blue-50/60 px-4 py-2.5 dark:bg-blue-950/20">
            <span className="text-blue-500">{KIND_ICON[draft.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{draft.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{safeExplain(draft, fields)}</p>
            </div>
            <Button type="button" size="sm" className="h-7 shrink-0 text-xs" onClick={apply}>
              Apply
            </Button>
          </div>
        )}

        <div className="flex-shrink-0 border-t border-border p-3">
          <div className="relative rounded-2xl border border-border bg-background focus-within:border-blue-400">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the chart, or ask to change it…"
              rows={1}
              className="max-h-[120px] w-full resize-none bg-transparent py-3 pl-3.5 pr-11 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none"
              style={{ minHeight: '46px' }}
              disabled={isStreaming}
            />
            <Button
              type="button"
              size="icon"
              className="absolute bottom-2 right-2 h-7 w-7 rounded-full disabled:opacity-40"
              onClick={() => void handleSend()}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function safeExplain(chart: AiChart, fields: CatalogField[]): string {
  try {
    return explainSpec(chart.spec, fields) || 'Ready to add to the dashboard.'
  } catch {
    return 'Ready to add to the dashboard.'
  }
}

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="whitespace-pre-wrap [&:not(:first-child)]:mt-2">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10">{children}</code>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc space-y-0.5 pl-4 [&:not(:first-child)]:mt-2">{children}</ul>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
}

function AssistantBubble({
  content, streaming, chartStatus, chartError,
}: Readonly<{
  content: string
  streaming?: boolean
  chartStatus?: ChartStatus
  chartError?: string
}>) {
  if (!content && streaming) {
    return (
      <span className="inline-flex gap-1 py-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: '150ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: '300ms' }} />
      </span>
    )
  }

  const jsonStart = content.lastIndexOf('```json')
  const hasOpenJsonBlock = jsonStart !== -1 && !content.slice(jsonStart + 7).includes('```')
  const visibleContent = streaming && hasOpenJsonBlock ? content.slice(0, jsonStart) : content
  const textOnly = visibleContent.replace(/```json[\s\S]*?```/g, '').trim()

  return (
    <div className="space-y-1.5">
      {textOnly && <ReactMarkdown components={MARKDOWN_COMPONENTS}>{textOnly}</ReactMarkdown>}
      {streaming && hasOpenJsonBlock && (
        <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Building the chart…
        </div>
      )}
      {!streaming && chartStatus === 'ok' && (
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          <Sparkles className="h-3 w-3" /> Draft ready below — Apply when you&apos;re happy with it
        </div>
      )}
      {!streaming && chartStatus === 'error' && (
        <div className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <span>⚠</span>
          <span>Couldn&apos;t build that: {chartError || 'invalid chart'}</span>
        </div>
      )}
    </div>
  )
}
