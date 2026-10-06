/**
 * "Generate with AI" — a chat that lives in the dashboard's side panel, not a
 * dialog, so the dashboard stays in view while you build. It is a chat rather
 * than a one-shot box so a vague first try can be refined ("make it a pie",
 * "last 7 days") and so one conversation can produce several charts: every
 * chart the AI proposes shows up as its own card with its own Add button, and
 * adding one does not close the chat or move you away from it.
 *
 * The model only ever proposes; a chart never reaches Add until
 * `validateAiChart` (`aiChartSpec.ts`) has re-checked it against `Spec` in the
 * browser, the same way `WorkflowChat` validates before calling `setWorkflow`.
 */
'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowUp, BarChart3, Check, Hash, LineChart as LineIcon, Loader2, PieChart as PieIcon,
  Plus, RotateCcw, Sparkles, Table2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import type { CatalogField, ChartKind } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'
import type { OutcomeRanking } from './OutcomeOrderEditor'
import { explainSpec } from './explain'
import { suggestions } from './suggest'
import { type AiChart, extractChartJsons, stripJsonBlocksForHistory, validateAiChart } from './aiChartSpec'

const KIND_ICON: Record<ChartKind, React.ReactNode> = {
  kpi: <Hash className="h-3.5 w-3.5" />,
  bar: <BarChart3 className="h-3.5 w-3.5" />,
  line: <LineIcon className="h-3.5 w-3.5" />,
  pie: <PieIcon className="h-3.5 w-3.5" />,
  table: <Table2 className="h-3.5 w-3.5" />,
  text: <Hash className="h-3.5 w-3.5" />,
  formula: <Hash className="h-3.5 w-3.5" />,
}

// only used when the agent has no fields to suggest from yet
const FALLBACK_SUGGESTIONS = [
  'Bar chart of calls by why they ended, last 30 days',
  'Pie chart of outcomes this week',
  'Total calls as a number card',
]

interface ChartCardState {
  id: string
  chart: AiChart
  added: boolean
}
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  charts?: ChartCardState[]
  errors?: string[]
  /** Sent to the model but never drawn: the automatic "fix this" retry. */
  hidden?: boolean
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

/** One read that gives up only after the stream has been silent for SILENCE_TIMEOUT_MS, and cleans up its own timer. */
async function readWithSilenceTimeout(reader: ReadableStreamDefaultReader<Uint8Array>, abort: AbortController) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          abort.abort()
          reject(new Error('Response timed out — try a shorter request'))
        }, SILENCE_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function streamAssistantReply(res: Response, abort: AbortController, onChunk: (content: string) => void) {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response stream')

  const decoder = new TextDecoder()
  const state = { content: '', truncated: false }
  let buffer = ''

  while (true) {
    const { done, value } = await readWithSilenceTimeout(reader, abort)
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) applySSELine(line, state, onChunk)
  }
  return { assistantContent: state.content, wasTruncated: state.truncated }
}

const newId = () => crypto.randomUUID()

/** Marks one proposed chart (or every chart in the message, when no index is given) as added. */
function markAdded(messages: Message[], messageIndex: number, chartIndex?: number): Message[] {
  return messages.map((m, i) => {
    if (i !== messageIndex || !m.charts) return m
    const charts = m.charts.map((c, j) => (chartIndex === undefined || j === chartIndex ? { ...c, added: true } : c))
    return { ...m, charts }
  })
}

function lastChartOf(messages: Message[]): AiChart | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const charts = messages[i].charts
    if (charts?.length) return charts.at(-1)!.chart
  }
  return null
}

export function AiChartBuilderPanel({
  agentId, fields, ranking, visible, onBack, onAdd,
}: Readonly<{
  agentId: string
  fields: CatalogField[]
  ranking?: OutcomeRanking
  /** The panel stays mounted while a chart's settings are open, so the chat is not lost; this is whether it is the one on screen. */
  visible: boolean
  onBack: () => void
  /** Puts a chart on the dashboard as an unsaved draft. Must not change what is selected. */
  onAdd: (title: string, kind: ChartKind, spec: SpecInput) => void
}>) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 100)
  }, [visible])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    setIsStreaming(false)
  }, [])

  const patchLast = useCallback((patch: Partial<Message>) => {
    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1] = { ...updated.at(-1)!, ...patch }
      return updated
    })
  }, [])

  // One request/stream/validate round-trip. Appends a fresh assistant bubble and
  // fills it as chunks arrive. Reports whether the reply built any chart, and
  // whether a retry could help (every chart in it failed validation).
  const sendAndValidate = useCallback(
    async (conversation: Message[], abort: AbortController, opts: { silentOnError?: boolean } = {}) => {
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
          currentChart: lastChartOf(conversation),
        }),
        signal: abort.signal,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Request failed (${res.status})`)
      }

      setMessages((prev) => [...prev, { id: newId(), role: 'assistant', content: '' }])
      const { assistantContent, wasTruncated } = await streamAssistantReply(res, abort, (content) => patchLast({ content }))

      if (wasTruncated) {
        const err = 'Response was cut off — try a shorter or simpler request.'
        if (!silentOnError) toast.error(err, { duration: 8000 })
        patchLast({ errors: [err] })
        return { status: 'error' as const, error: err, retryable: false }
      }

      const candidates = extractChartJsons(assistantContent)
      if (candidates.length === 0) return { status: 'none' as const, retryable: false }

      const charts: ChartCardState[] = []
      const errors: string[] = []
      for (const candidate of candidates.slice(0, 4)) {
        const result = validateAiChart(candidate, fields)
        if (result.ok) charts.push({ id: newId(), chart: result.chart, added: false })
        else errors.push(result.error)
      }
      patchLast({ charts, errors })

      if (charts.length === 0) {
        const first = errors[0] ?? 'invalid chart'
        if (!silentOnError) toast.error(`Couldn't build that chart: ${first}`, { duration: 8000 })
        return { status: 'error' as const, error: first, retryable: true }
      }
      return { status: 'ok' as const, retryable: false }
    },
    [agentId, fields, ranking, patchLast]
  )

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim()
      if (!text || isStreaming) return

      let conversation: Message[] = [...messages, { id: newId(), role: 'user', content: text }]
      setMessages(conversation)
      setInput('')
      setIsStreaming(true)

      const abort = new AbortController()
      abortRef.current = abort

      try {
        const first = await sendAndValidate(conversation, abort, { silentOnError: true })

        if (first.retryable) {
          // The person never sees the failed attempt or the automatic nudge, only the corrected answer.
          const retryMsg: Message = {
            id: newId(),
            role: 'user',
            hidden: true,
            content: `The chart you just returned failed validation: ${first.error}. Fix this and return the corrected COMPLETE chart.`,
          }
          patchLast({ hidden: true })
          conversation = [...conversation, { id: newId(), role: 'assistant', content: '(previous attempt — see error below)', hidden: true }, retryMsg]
          setMessages((prev) => [...prev, retryMsg])
          await sendAndValidate(conversation, abort, { silentOnError: false })
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
    [input, isStreaming, messages, sendAndValidate, patchLast]
  )

  const addChart = (messageIndex: number, chartIndex: number) => {
    const card = messages[messageIndex]?.charts?.[chartIndex]
    if (!card || card.added) return
    onAdd(card.chart.title, card.chart.kind, card.chart.spec)
    toast.success(`Added "${card.chart.title}"`)
    setMessages((prev) => markAdded(prev, messageIndex, chartIndex))
  }

  const addAll = (messageIndex: number) => {
    const cards = messages[messageIndex]?.charts ?? []
    const pending = cards.filter((c) => !c.added)
    for (const c of pending) onAdd(c.chart.title, c.chart.kind, c.chart.spec)
    if (pending.length) toast.success(`Added ${pending.length} charts`)
    setMessages((prev) => markAdded(prev, messageIndex))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const chips = suggestions(fields).slice(0, 3).map((s) => s.title)
  const chipList = chips.length > 0 ? chips : FALLBACK_SUGGESTIONS
  const anyAdded = messages.some((m) => m.charts?.some((c) => c.added))
  const shown = messages.filter((m) => !m.hidden)

  return (
    <aside className="flex h-full w-full flex-col border-l border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900/40">
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 py-2.5 pl-3 pr-10 dark:border-gray-800">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chart types"
          className="rounded p-1 text-gray-500 transition hover:bg-gray-200/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/40">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">Generate with AI</p>
          <p className="truncate text-[11px] leading-tight text-gray-500 dark:text-gray-400">Describe charts, then add the ones you want</p>
        </div>
        {messages.length > 0 && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={reset} title="Start over">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {shown.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="px-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              {fields.length === 0 ? 'This agent has no fields to chart yet. Try one of these anyway, or describe your own:' : 'Try one of these, or describe your own:'}
            </p>
            {chipList.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSend(s)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.hidden) return null
          const isLast = i === messages.length - 1
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[90%] whitespace-pre-wrap rounded-xl bg-blue-600 px-3 py-2 text-sm leading-relaxed text-white">{msg.content}</div>
              </div>
            )
          }
          return (
            <div key={msg.id} className="space-y-2">
              <AssistantText content={msg.content} streaming={isStreaming && isLast} />
              {(msg.charts?.length ?? 0) > 1 && msg.charts!.some((c) => !c.added) && (
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addAll(i)}>
                  <Plus className="mr-1 h-3 w-3" /> Add all {msg.charts!.length}
                </Button>
              )}
              {msg.charts?.map((c, j) => (
                <ChartProposal key={c.id} state={c} fields={fields} onAdd={() => addChart(i, j)} />
              ))}
              {!(isStreaming && isLast) && msg.errors?.map((err) => (
                <div key={err} className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  <span>⚠</span>
                  <span>Couldn&apos;t build one of the charts: {err}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="shrink-0 border-t border-gray-200 p-3 dark:border-gray-800">
        {anyAdded && (
          <p className="mb-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
            Added charts are drafts on the dashboard. Press Save at the top to keep them.
          </p>
        )}
        <div className="relative rounded-2xl border border-gray-300 bg-white focus-within:border-blue-400 dark:border-gray-700 dark:bg-gray-950">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a chart, or ask to change it…"
            aria-label="Describe the chart you want"
            rows={1}
            maxLength={2000}
            className="max-h-[120px] w-full resize-none bg-transparent py-3 pl-3.5 pr-11 text-sm leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
            style={{ minHeight: '46px' }}
            disabled={isStreaming}
          />
          <Button
            type="button"
            size="icon"
            aria-label="Send"
            className="absolute bottom-2 right-2 h-7 w-7 rounded-full disabled:opacity-40"
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </aside>
  )
}

function rangeLabel(spec: SpecInput): string | null {
  const range = spec.range as { days?: number; from?: string; to?: string } | undefined
  if (range?.days) return `Last ${range.days} days`
  if (range?.from && range?.to) return `${range.from} to ${range.to}`
  return null
}

function safeExplain(chart: AiChart, fields: CatalogField[]): string {
  try {
    return explainSpec(chart.spec, fields) || 'Ready to add to the dashboard.'
  } catch {
    return 'Ready to add to the dashboard.'
  }
}

/** One proposed chart: what it is in plain words, with the whole description visible, and its own Add button. */
function ChartProposal({
  state, fields, onAdd,
}: Readonly<{ state: ChartCardState; fields: CatalogField[]; onAdd: () => void }>) {
  const { chart, added } = state
  const range = rangeLabel(chart.spec)
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-blue-500">{KIND_ICON[chart.kind]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{chart.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">{safeExplain(chart, fields)}</p>
          {range && <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">{range}</p>}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={added ? 'outline' : 'default'}
        disabled={added}
        onClick={onAdd}
        className="mt-2 h-7 w-full text-xs"
      >
        {added ? <><Check className="mr-1 h-3 w-3" /> Added</> : <><Plus className="mr-1 h-3 w-3" /> Add to dashboard</>}
      </Button>
    </div>
  )
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

function AssistantText({ content, streaming }: Readonly<{ content: string; streaming?: boolean }>) {
  if (!content && streaming) {
    return (
      <span className="inline-flex gap-1 py-1 text-gray-500">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: '150ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: '300ms' }} />
      </span>
    )
  }

  const jsonStart = content.lastIndexOf('```json')
  const hasOpenJsonBlock = jsonStart !== -1 && !content.slice(jsonStart + 7).includes('```')
  const visibleContent = streaming && hasOpenJsonBlock ? content.slice(0, jsonStart) : content
  const textOnly = visibleContent.replaceAll(/```json[\s\S]*?```/g, '').trim()

  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
      {textOnly && <ReactMarkdown components={MARKDOWN_COMPONENTS}>{textOnly}</ReactMarkdown>}
      {streaming && hasOpenJsonBlock && (
        <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Building the chart…
        </div>
      )}
    </div>
  )
}
