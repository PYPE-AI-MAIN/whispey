'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { ArrowUp, Sparkles, X, Loader2, User, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { useWorkflowStore } from '@/stores/workflowStore'
import { safeParseWorkflow } from '@/lib/workflow/schema'
import { lintWorkflow, hasErrors } from '@/lib/workflow/linter'
import { isRetryableApplyError } from '@/lib/workflow/chatRetry'
import toast from 'react-hot-toast'

interface Message {
  role: 'user' | 'assistant'
  content: string
  applyStatus?: 'success' | 'error' | 'none'
  applyError?: string
  applyNodeCount?: number
  applyWarnings?: string[]
}

// Past assistant turns embed a full workflow JSON block. Re-sending those on every
// request balloons context linearly (the current workflow is already sent separately
// as a system message), causing slow/hanging generations after a few turns.
// ponytail: walk ``` fences with indexOf instead of a [\s\S]*? regex — same
// result, no backtracking-vulnerable pattern for Sonar/CodeQL to flag.
function stripJsonBlocksForHistory(text: string): string {
  const placeholder = '[workflow JSON omitted — current workflow is provided above]'
  let result = ''
  let pos = 0
  while (pos < text.length) {
    const start = text.indexOf('```json', pos)
    if (start === -1) {
      result += text.slice(pos)
      break
    }
    const end = text.indexOf('```', start + 7)
    if (end === -1) {
      result += text.slice(pos)
      break
    }
    result += text.slice(pos, start) + placeholder
    pos = end + 3
  }
  return result
}

type ContextSummary = { nodeCount: number; startLabel: string; langCount: number; varCount: number } | null

/** The header subtitle — "already loaded" answer to the question every user
 * asks first. Plain string building instead of a nested ternary inside a
 * nested template literal, which is exactly as unreadable as it sounds. */
function formatContextSummary(contextSummary: ContextSummary): string {
  if (!contextSummary) return 'Describe what to build or change'
  let text = `${contextSummary.nodeCount} nodes · starts at "${contextSummary.startLabel}"`
  if (contextSummary.varCount) text += ` · ${contextSummary.varCount} vars`
  if (contextSummary.langCount) text += ` · ${contextSummary.langCount} languages`
  return text
}

function extractWorkflowJson(text: string): object | null {
  const start = text.indexOf('```json')
  if (start === -1) return null
  const end = text.indexOf('```', start + 7)
  if (end === -1) return null
  const raw = text.slice(start + 7, end).trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// The system prompt tells the model to write "__KEEP__" instead of retyping a large
// unchanged prompt/persona field — restore the real value from the current workflow
// here so the model never has to round-trip huge text through its output.
const KEEP_MARKER = '__KEEP__'
function restoreKeptFields(next: any, current: any): any {
  if (!current) return next
  if (next?.agent?.globalPrompt === KEEP_MARKER) {
    next.agent.globalPrompt = current.agent?.globalPrompt ?? ''
  }
  if (Array.isArray(next?.nodes)) {
    const currentNodesById = new Map<string, any>((current.nodes || []).map((n: any) => [n.id, n]))
    next.nodes = next.nodes.map((n: any) => {
      const orig = currentNodesById.get(n.id)
      if (!orig) return n
      // Whole-node keep: the model output only { id, __keep__: true } instead of
      // retyping a large function/mcp node's headers/tokens/body/params.
      if (n.__keep__ === true) return orig
      const patched = { ...n }
      if (patched.prompt === KEEP_MARKER) patched.prompt = orig.prompt ?? ''
      if (patched.staticText === KEEP_MARKER) patched.staticText = orig.staticText ?? ''
      return patched
    })
  }
  return next
}

export function WorkflowChat({
  open,
  onOpenChange,
  initialMessage,
  onInitialMessageConsumed,
}: Readonly<{
  open: boolean
  onOpenChange: (v: boolean) => void
  // Set by the chat-first landing screen: a prompt typed before any workflow
  // existed. Sent automatically the first time the panel opens with it set,
  // so "describe your agent" -> building starts in one step instead of
  // pick-a-template-then-open-chat-then-retype.
  initialMessage?: string | null
  onInitialMessageConsumed?: () => void
}>) {
  const workflow = useWorkflowStore((s) => s.workflow)
  // Shown before the first message so it's visible, not just true, that the
  // model already has the current graph — the question every user asks first.
  const contextSummary = useMemo(() => {
    if (!workflow) return null
    const startNode = workflow.nodes.find((n) => n.id === workflow.start)
    return {
      nodeCount: workflow.nodes.length,
      startLabel: startNode?.name || startNode?.id || workflow.start,
      langCount: workflow.agent.languages?.length ?? 0,
      varCount: workflow.variables?.length ?? 0,
    }
  }, [workflow])
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow)
  const setChatStreaming = useWorkflowStore((s) => s.setChatStreaming)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  // Collapsed = just header + input, no history — a long conversation
  // shouldn't force the panel to stay huge; this is how you get canvas space
  // back without losing the thread or closing the panel outright.
  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Applies one `data: {...}` SSE line to the running assistant text, returning
  // the updated content/truncated state. Mutating a plain object here (instead
  // of threading 4 separate return values) is what keeps the caller's loop simple.
  const applySSELine = useCallback((line: string, state: { content: string; truncated: boolean }, onChunk: (content: string) => void) => {
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
    } catch (e: any) {
      if (e.message && !e.message.includes('Unexpected')) throw e
    }
  }, [])

  // Reads the SSE stream into `onChunk`, resolving to the full assistant text
  // and whether the server flagged the response as truncated.
  const streamAssistantReply = useCallback(
    async (res: Response, abort: AbortController, onChunk: (content: string) => void) => {
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
            reject(new Error('Response timed out — try a shorter/simpler request'))
          }, 45000)),
        ])
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) applySSELine(line, state, onChunk)
      }

      return { assistantContent: state.content, wasTruncated: state.truncated }
    },
    [applySSELine]
  )

  // Parses the assistant's trailing ```json block (if any) and applies it to
  // the workflow store, reporting success/failure via toast + message status.
  // `silentOnError` skips the error toast — used for a first attempt that's
  // about to get one automatic self-correction retry, so a mistake the model
  // fixes on its own never flashes a scary error at whoever is self-serving.
  const applyAssistantWorkflow = useCallback(
    (
      assistantContent: string,
      opts: { silentOnError?: boolean } = {}
    ): { applyStatus: Message['applyStatus']; applyError?: string; applyNodeCount?: number; applyWarnings?: string[] } => {
      const { silentOnError = false } = opts
      const fail = (applyError: string) => {
        if (!silentOnError) toast.error(applyError, { duration: 10000 })
        return { applyStatus: 'error' as const, applyError }
      }

      const jsonBlockStart = assistantContent.indexOf('```json')
      const hasJsonBlock = jsonBlockStart !== -1 && assistantContent.slice(jsonBlockStart + 7).includes('```')
      const json = extractWorkflowJson(assistantContent)
      if (!json) {
        if (!hasJsonBlock) return { applyStatus: 'none' }
        return fail('Response JSON was malformed (likely cut off — try a shorter/simpler request)')
      }

      const parsed = safeParseWorkflow(restoreKeptFields(json, workflow))
      // safeParse passes on an empty/graph-less workflow (only `start` is
      // required, and it isn't checked against node ids). That renders a blank
      // canvas but shows a misleading "applied" — reject it and say why.
      if (!parsed.success) {
        const applyError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        return fail(`AI returned invalid workflow JSON: ${applyError}`)
      }
      if (parsed.data.nodes.length === 0 || !parsed.data.nodes.some((n) => n.id === parsed.data.start)) {
        return fail(
          'The AI returned a workflow with no usable nodes — the config is too large to convert in one shot. Ask it to "build the flow step by step" (greeting, then patient lookup, then symptoms, …), or paste the flow in a few smaller messages.'
        )
      }

      // "Chat-only" only works if problems surface HERE — the same lint the
      // canvas warning badge runs, since a user who never opens the canvas
      // would otherwise never see a dangling edge or dead-end node at all.
      const issues = lintWorkflow(parsed.data)
      if (hasErrors(issues)) {
        const applyError = issues
          .filter((i) => i.severity === 'error')
          .slice(0, 3)
          .map((i) => i.message)
          .join('; ')
        return fail(`AI returned a broken workflow graph: ${applyError}`)
      }

      setWorkflow(parsed.data)
      toast.success('Workflow updated from chat')
      const warnings = issues.filter((i) => i.severity === 'warning')
      return {
        applyStatus: 'success',
        applyNodeCount: parsed.data.nodes.length,
        applyWarnings: warnings.length ? warnings.slice(0, 3).map((i) => i.message) : undefined,
      }
    },
    [workflow, setWorkflow]
  )

  // One request/stream/apply round-trip. Appends a fresh assistant bubble and
  // fills it as chunks arrive; returns the apply result so the caller can
  // decide whether this needs a self-correction retry.
  const sendAndApply = useCallback(
    async (
      conversationMessages: Pick<Message, 'role' | 'content'>[],
      abort: AbortController,
      opts: { silentOnError?: boolean } = {}
    ) => {
      const { silentOnError = false } = opts
      const res = await fetch('/api/workflow/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationMessages.map((m) => ({
            role: m.role,
            content: m.role === 'assistant' ? stripJsonBlocksForHistory(m.content) : m.content,
          })),
          workflow,
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
        const err = 'Response was cut off (too long to generate in one reply) — the workflow was NOT applied. Try a shorter request, or build the flow structure via chat and paste large prompts directly into the Global Prompt field instead.'
        if (!silentOnError) toast.error(err, { duration: 10000 })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated.at(-1)!, applyStatus: 'error', applyError: err }
          return updated
        })
        return { applyStatus: 'error' as const, applyError: err, retryable: false }
      }

      const { applyStatus, applyError, applyNodeCount, applyWarnings } = applyAssistantWorkflow(assistantContent, { silentOnError })
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated.at(-1)!, applyStatus, applyError, applyNodeCount, applyWarnings }
        return updated
      })
      const retryable = applyStatus === 'error' && isRetryableApplyError(applyError)
      return { applyStatus, applyError, retryable }
    },
    [workflow, streamAssistantReply, applyAssistantWorkflow]
  )

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isStreaming) return

    const userMsg: Message = { role: 'user', content: text }
    let conversation = [...messages, userMsg]
    setMessages(conversation)
    setInput('')
    setIsStreaming(true)
    setChatStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      // Silent: an error here might self-correct below, and toasting a
      // mistake the model is about to fix on its own just alarms whoever is
      // self-serving this workflow for no reason.
      const first = await sendAndApply(conversation, abort, { silentOnError: true })

      // One self-correction pass: feed the exact validation/lint errors back
      // as a follow-up turn so a fixable mistake (a dangling edge, {{var}} in
      // a code node, a missing fallback) gets corrected automatically instead
      // of surfacing to whoever is self-serving this workflow.
      if (first.retryable) {
        const retryMsg: Message = {
          role: 'user',
          content: `The workflow you just returned failed validation: ${first.applyError}. Fix these specific issues and return the corrected COMPLETE workflow JSON.`,
        }
        conversation = [...conversation, { role: 'assistant', content: '(previous attempt — see error below)' }, retryMsg]
        setMessages((prev) => [...prev, retryMsg])
        // Non-silent: this is the last attempt either way, so its outcome
        // (fixed, or still broken) is what the user should actually see.
        await sendAndApply(conversation, abort, { silentOnError: false })
      } else if (first.applyStatus === 'error' && first.applyError) {
        // Not retryable (e.g. truncated) — nothing more to try, surface it now.
        toast.error(first.applyError, { duration: 10000 })
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      toast.error(err.message || 'Chat request failed')
      setMessages((prev) => {
        if (prev.length && prev.at(-1)?.role === 'assistant' && !prev.at(-1)?.content) {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setIsStreaming(false)
      setChatStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, sendAndApply, setChatStreaming])

  const sentInitialRef = useRef(false)
  useEffect(() => {
    if (!open || !initialMessage || sentInitialRef.current) return
    sentInitialRef.current = true
    onInitialMessageConsumed?.()
    handleSend(initialMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per mount when initialMessage arrives, not on every handleSend identity change
  }, [open, initialMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!open) return null

  return (
    <div
      className={`absolute right-4 top-1/2 -translate-y-1/2 z-50 w-[min(760px,calc(100%-2rem))] ${
        collapsed ? '' : 'max-h-[74vh]'
      } bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
    >
      {/* Header — the subtitle IS the "already loaded" answer: what's already
          built, right where you'd look for it, instead of a separate card
          repeating the same thing lower down. */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Workflow Builder</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight truncate">
            {formatContextSummary(contextSummary)}
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMessages([])}
            title="Clear chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Expand chat' : 'Collapse chat'}
          >
            {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className={`flex-1 overflow-y-auto px-5 py-4 space-y-4 ${collapsed ? 'hidden' : ''}`}>
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 py-1">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 px-0.5">
              {contextSummary ? 'Try one of these, or describe your own change:' : 'Try one of these, or describe what to build:'}
            </p>
            {[
              'Create an appointment booking flow',
              'Add a logic split after the greeting node',
              'Add call transfer to +1234567890 when the user asks for support',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => { setInput(suggestion); setTimeout(() => inputRef.current?.focus(), 0) }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={`${msg.role}-${i}`} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
              }`}
            >
              {msg.role === 'assistant' ? (
                <AssistantMessage
                  content={msg.content}
                  streaming={isStreaming && i === messages.length - 1}
                  applyStatus={msg.applyStatus}
                  applyError={msg.applyError}
                  applyNodeCount={msg.applyNodeCount}
                  applyWarnings={msg.applyWarnings}
                />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input — one rounded composer with the send button floating inside it,
          bottom-right (Claude's own chat-input pattern), not a pill + a
          separate button bolted on beside it. */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <div className="relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm focus-within:border-violet-400 dark:focus-within:border-violet-500 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what to build or change…"
            rows={1}
            className="w-full bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none outline-none max-h-[160px] leading-relaxed pl-4 pr-11 pt-3.5 pb-3.5"
            style={{ minHeight: '52px' }}
          />
          <Button
            size="icon"
            className="absolute right-2.5 bottom-2.5 h-8 w-8 rounded-full bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 disabled:bg-gray-300 dark:disabled:bg-gray-700"
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Compact chat-bubble sizing (text-xs) — the default element margins/list
// styles are built for full-page prose, not a 13px-wide message bubble.
const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="whitespace-pre-wrap [&:not(:first-child)]:mt-2">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[11px]">{children}</code>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-4 space-y-0.5 [&:not(:first-child)]:mt-2">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-4 space-y-0.5 [&:not(:first-child)]:mt-2">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
}

function AssistantMessage({
  content,
  streaming,
  applyStatus,
  applyError,
  applyNodeCount,
  applyWarnings,
}: Readonly<{
  content: string
  streaming?: boolean
  applyStatus?: Message['applyStatus']
  applyError?: string
  applyNodeCount?: number
  applyWarnings?: string[]
}>) {
  if (!content && streaming) {
    return (
      <span className="inline-flex gap-1 py-1">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
    )
  }

  const hasOpenJsonBlock = /```json[\s\S]*$/.test(content) && !/```json[\s\S]*?```/.test(content.slice(content.lastIndexOf('```json')))
  let visibleContent = content
  if (streaming && hasOpenJsonBlock) {
    visibleContent = content.slice(0, content.lastIndexOf('```json'))
  }

  const parts = visibleContent.split(/(```json[\s\S]*?```)/g)
  // Key off each part's running character offset in visibleContent rather than
  // its array index — the split is deterministic per render, so the offset is
  // a stable, content-derived id (and sidesteps the array-index-as-key rule).
  let offset = 0
  const partsWithOffset = parts.map((part) => {
    const at = offset
    offset += part.length
    return { part, at }
  })
  return (
    <div className="space-y-1.5">
      {partsWithOffset.map(({ part, at }) =>
        part.startsWith('```json') ? (
          <AssistantMessageJsonPart
            key={`json-${at}`}
            streaming={streaming}
            applyStatus={applyStatus}
            applyError={applyError}
            applyNodeCount={applyNodeCount}
            applyWarnings={applyWarnings}
          />
        ) : (
          part.trim() && (
            <div key={`text-${at}`}>
              <ReactMarkdown components={MARKDOWN_COMPONENTS}>{part.trim()}</ReactMarkdown>
            </div>
          )
        )
      )}
      {streaming && hasOpenJsonBlock && (
        <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating workflow...
        </div>
      )}
    </div>
  )
}

function formatAppliedNodeCount(applyNodeCount: number | undefined): string {
  if (applyNodeCount == null) return ''
  const plural = applyNodeCount === 1 ? '' : 's'
  return ` — ${applyNodeCount} node${plural}`
}

/** One ```json block's status badge — pulled out of AssistantMessage so that
 * function's cognitive complexity stays about "which parts make up a
 * message", not also "what does a json part look like in each apply state". */
function AssistantMessageJsonPart({
  streaming,
  applyStatus,
  applyError,
  applyNodeCount,
  applyWarnings,
}: Readonly<{
  streaming?: boolean
  applyStatus?: Message['applyStatus']
  applyError?: string
  applyNodeCount?: number
  applyWarnings?: string[]
}>) {
  if (streaming) {
    return (
      <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
        <Loader2 className="w-3 h-3 animate-spin" />
        Parsing workflow...
      </div>
    )
  }
  if (applyStatus === 'error') {
    return (
      <div className="flex items-start gap-1.5 py-1 px-2 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-[10px] font-medium">
        <span>⚠</span>
        <span>Failed to apply: {applyError || 'invalid workflow JSON'}</span>
      </div>
    )
  }
  // A trivial node count on a real build request usually means the model
  // under-built rather than that the ask was too vague — flag it instead of
  // showing the same "success" green as a real result.
  const isSuspiciouslySmall = (applyNodeCount ?? 0) <= 3
  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded-md text-[10px] font-medium ${
          isSuspiciouslySmall
            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
        }`}
      >
        <Sparkles className="w-3 h-3" />
        Applied to canvas{formatAppliedNodeCount(applyNodeCount)}
        {isSuspiciouslySmall ? " (looks small — ask for more detail if this isn't what you meant)" : ''}
      </div>
      {/* Same lint the canvas warning badge runs — shown here too since the
          whole point of chat-only building is never opening the canvas. */}
      {applyWarnings && applyWarnings.length > 0 && (
        <div className="py-1 px-2 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px]">
          <p className="font-medium mb-0.5">
            ⚠ {applyWarnings.length} warning{applyWarnings.length === 1 ? '' : 's'}:
          </p>
          <ul className="list-disc pl-3.5 space-y-0.5">
            {applyWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
