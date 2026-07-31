'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, X, Loader2, User, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkflowStore } from '@/stores/workflowStore'
import { safeParseWorkflow } from '@/lib/workflow/schema'
import toast from 'react-hot-toast'

interface Message {
  role: 'user' | 'assistant'
  content: string
  applyStatus?: 'success' | 'error' | 'none'
  applyError?: string
}

// Past assistant turns embed a full workflow JSON block. Re-sending those on every
// request balloons context linearly (the current workflow is already sent separately
// as a system message), causing slow/hanging generations after a few turns.
function stripJsonBlocksForHistory(text: string): string {
  return text.replace(/```json[\s\S]*?```/g, '[workflow JSON omitted — current workflow is provided above]')
}

function extractWorkflowJson(text: string): object | null {
  const match = text.match(/```json\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
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

export function WorkflowChat({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const workflow = useWorkflowStore((s) => s.workflow)
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/workflow/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
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

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let assistantContent = ''
      let wasTruncated = false

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

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

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.truncated) wasTruncated = true
            if (parsed.content) {
              assistantContent += parsed.content
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                return updated
              })
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('Unexpected')) throw e
          }
        }
      }

      if (wasTruncated) {
        const err = 'Response was cut off (too long to generate in one reply) — the workflow was NOT applied. Try a shorter request, or build the flow structure via chat and paste large prompts directly into the Global Prompt field instead.'
        toast.error(err, { duration: 10000 })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], applyStatus: 'error', applyError: err }
          return updated
        })
        return
      }

      const hasJsonBlock = /```json[\s\S]*?```/.test(assistantContent)
      const json = extractWorkflowJson(assistantContent)
      let applyStatus: Message['applyStatus'] = 'none'
      let applyError: string | undefined
      if (json) {
        const parsed = safeParseWorkflow(restoreKeptFields(json, workflow))
        // safeParse passes on an empty/graph-less workflow (only `start` is
        // required, and it isn't checked against node ids). That renders a blank
        // canvas but shows a misleading "applied" — reject it and say why.
        if (!parsed.success) {
          applyError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
          toast.error(`AI returned invalid workflow JSON: ${applyError}`, { duration: 8000 })
          applyStatus = 'error'
        } else if (
          parsed.data.nodes.length === 0 ||
          !parsed.data.nodes.some((n) => n.id === parsed.data.start)
        ) {
          applyError =
            'The AI returned a workflow with no usable nodes — the config is too large to convert in one shot. Ask it to "build the flow step by step" (greeting, then patient lookup, then symptoms, …), or paste the flow in a few smaller messages.'
          toast.error(applyError, { duration: 10000 })
          applyStatus = 'error'
        } else {
          setWorkflow(parsed.data)
          toast.success('Workflow updated from chat')
          applyStatus = 'success'
        }
      } else if (hasJsonBlock) {
        applyError = 'Response JSON was malformed (likely cut off — try a shorter/simpler request)'
        toast.error(applyError, { duration: 8000 })
        applyStatus = 'error'
      }
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], applyStatus, applyError }
        return updated
      })
    } catch (err: any) {
      if (err.name === 'AbortError') return
      toast.error(err.message || 'Chat request failed')
      setMessages((prev) => {
        if (prev.length && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content) {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, workflow, setWorkflow])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!open) return null

  return (
    <div className="absolute bottom-4 right-4 z-50 w-[420px] h-[560px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Workflow Builder</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">Describe what to build or change</p>
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
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Build with AI</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[260px]">
                Describe the workflow you want to build or what changes to make. The AI will generate the flow for you.
              </p>
            </div>
            <div className="space-y-1.5 w-full mt-2">
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
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-violet-600 dark:text-violet-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
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
                />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your workflow..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none outline-none max-h-[80px] leading-relaxed"
            style={{ minHeight: '24px' }}
          />
          <Button
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

function AssistantMessage({
  content,
  streaming,
  applyStatus,
  applyError,
}: {
  content: string
  streaming?: boolean
  applyStatus?: Message['applyStatus']
  applyError?: string
}) {
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
  return (
    <div className="space-y-1.5">
      {parts.map((part, i) => {
        if (part.startsWith('```json')) {
          if (streaming) {
            return (
              <div key={i} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Parsing workflow...
              </div>
            )
          }
          if (applyStatus === 'error') {
            return (
              <div key={i} className="flex items-start gap-1.5 py-1 px-2 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-[10px] font-medium">
                <span>⚠</span>
                <span>Failed to apply: {applyError || 'invalid workflow JSON'}</span>
              </div>
            )
          }
          return (
            <div key={i} className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
              <Sparkles className="w-3 h-3" />
              Workflow JSON applied to canvas
            </div>
          )
        }
        const trimmed = part.trim()
        if (!trimmed) return null
        return <span key={i} className="whitespace-pre-wrap">{trimmed}</span>
      })}
      {streaming && hasOpenJsonBlock && (
        <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating workflow...
        </div>
      )}
    </div>
  )
}
