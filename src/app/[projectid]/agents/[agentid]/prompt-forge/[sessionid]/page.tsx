'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlaskConical, Lock, Send, Copy, Check, RotateCcw, Download,
  Bot, WifiOff, Settings2, ChevronLeft, ChevronRight, CornerDownLeft,
  Zap, ChevronDown, Phone, X, Loader2, Code2, Save, Link2, History, Eye, CopyPlus, MessageSquareText,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { agentDisplayName } from '@/lib/agentDisplayName'
import { useAgentConfig } from '@/hooks/useAgentConfig'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'
import { modelProviders } from '@/config/llmCatalog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { VariableTextarea } from '@/components/agents/variables/VariableTextarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import CallFilter, { type FilterOperation } from '@/components/CallFilter'
import { extractFiltersAndDistinct } from '@/utils/callLogsUtils'
import { extractorKeys } from '@/components/calls/v2/split/callData'
import { usePiSurface } from '@/contexts/PiDockContext'

// ─── Constants ────────────────────────────────────────────────────────────────


// The agent's greeting, as Agent Config defines it (first_message_mode). Text only here.
type GreetingMode = 'assistant_waits_for_user' | 'assistant_speaks_first' | 'assistant_speaks_with_generated'
interface Greeting { mode: GreetingMode; text: string }
const GREETING_MODES: Array<{ value: GreetingMode; label: string; hint: string }> = [
  { value: 'assistant_speaks_first', label: 'Agent speaks first', hint: 'Sends this greeting as the first message' },
  { value: 'assistant_speaks_with_generated', label: 'Agent generates the greeting', hint: 'The model writes the first message from the prompt' },
  { value: 'assistant_waits_for_user', label: 'Wait for the user', hint: 'No greeting — the user writes first' },
]
const isGreetingMode = (v: unknown): v is GreetingMode => GREETING_MODES.some(m => m.value === v)

/** Reads an agent's greeting from its first_message_mode (an object or a bare mode string) and first_message. */
function readGreeting(modeRaw: unknown, firstMessage: unknown): Greeting | null {
  const obj = modeRaw && typeof modeRaw === 'object' ? modeRaw as { mode?: unknown; first_message?: unknown } : null
  const mode = obj ? obj.mode : modeRaw
  const text = (typeof firstMessage === 'string' && firstMessage) || (typeof obj?.first_message === 'string' ? obj.first_message : '')
  if (isGreetingMode(mode)) return { mode, text }
  return text ? { mode: 'assistant_speaks_first', text } : null
}

/** Pipecat and workflow configs call Azure `azure`; Agent Config calls it `azure_openai`. */
function normalizeProvider(p: unknown): string {
  if (p === 'azure') return 'azure_openai'
  return typeof p === 'string' && p ? p : 'openai'
}

// A session's own variables; otherwise the agent's — except on a saved version, which keeps exactly what it saved.
function initialVariablesFor<T>(saved: T[] | undefined, isVersion: boolean, agentVariables: T[] | undefined): T[] {
  if (saved?.length) return saved
  return isVersion ? [] : agentVariables ?? []
}

function modelLabelFor(provider: string, model: string): string {
  const entry = modelProviders[provider]
  const models = entry?.type === 'grouped' ? entry.groups?.flatMap(g => g.models) ?? [] : entry?.models ?? []
  const label = models.find(m => m.value === model)?.label ?? model
  return entry && provider !== 'openai' ? `${entry.label} / ${label}` : label
}

/** What the real agent is configured with (Agent Config / Pipecat). */
interface AgentDefaults {
  prompt: string; model: string; provider: string; temperature: number | null
  greeting: Greeting | null; tools: AgentTool[]; variables: Variable[]
}

/** A variable's value as text; non-string values (numbers, objects) as JSON. */
const variableText = (value: unknown): string => {
  if (value == null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/** Agent configs keep variables as { name: value }. */
const variablesFromRecord = (rec: unknown): Variable[] =>
  rec && typeof rec === 'object' && !Array.isArray(rec)
    ? Object.entries(rec as Record<string, unknown>)
        .filter(([name]) => !isSystemVariable(name))
        .map(([name, value]) => ({ name, value: variableText(value), description: '' }))
    : []

/** Every {{name}} used in these texts, in order of first use. */
function usedVariableNames(...texts: string[]): string[] {
  const names: string[] = []
  for (const text of texts) {
    for (const m of text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) if (!names.includes(m[1])) names.push(m[1])
  }
  return names
}
/** What the session (or version) itself stored — empty where it never set anything. */
interface SavedValues {
  prompt: string; model: string; provider: string; temperature: number | null
  greeting: Greeting | null; tools: AgentTool[]
}
interface Resolved { prompt: string; model: string; provider: string; temperature: number; greeting: Greeting; tools: AgentTool[] }

/** The session's own values win; the agent's config fills the rest (so tests run like the real agent). */
function mergeAgentDefaults(saved: SavedValues, agent: AgentDefaults | null): Resolved {
  const useAgentModel = !saved.model && !!agent?.model
  return {
    prompt: saved.prompt || agent?.prompt || '',
    model: saved.model || agent?.model || 'gpt-4o-mini',
    provider: (useAgentModel ? agent?.provider : saved.provider) || 'openai',
    temperature: saved.temperature ?? agent?.temperature ?? 0.7,
    greeting: saved.greeting ?? agent?.greeting ?? { mode: 'assistant_waits_for_user', text: '' },
    tools: saved.tools.length ? saved.tools : agent?.tools ?? [],
  }
}

function pipecatToolToAgentTool(t: any): AgentTool {
  const fn = t.function ?? {}
  const props = fn.parameters?.properties ?? {}
  const required: string[] = fn.parameters?.required ?? []
  return {
    id: crypto.randomUUID(),
    type: 'custom_function',
    name: fn.name ?? t.name ?? '',
    description: fn.description ?? t.description ?? '',
    endpoint: t.endpoint ?? '',
    method: t.method ?? 'POST',
    headers: t.headers ?? {},
    body: t.body ?? '',
    parameters: Object.entries(props).map(([name, schema]: [string, any]) => ({
      name, type: schema.type ?? 'string', description: schema.description ?? '', required: required.includes(name),
    })),
  }
}

interface SessionVersion { id: string; version: number; note: string | null; created_by_email: string | null; created_at: string }

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variable { name: string; value: string; description: string }
interface ToolParam { name: string; type: string; description: string; required: boolean }
interface AgentTool {
  id: string; type: string; name: string; description: string
  endpoint?: string; method?: string; headers?: Record<string, string>; body?: string
  parameters: ToolParam[]
  /** Playground only: answer with this instead of calling the endpoint. */
  mock?: { enabled: boolean; response: string; success?: boolean }
}
interface ParsedConfig {
  llm: { provider: string; model: string; temperature: number }
  prompt: string; variables: Variable[]; tools: AgentTool[]; greeting: Greeting | null
}
interface ToolCall {
  id?: string; name: string; arguments?: any; result?: any
  success?: boolean; duration_ms?: number; pending?: boolean
}
/** One piece of an agent reply, in the order it happened: text, a tool call, more text… */
type MessagePart = { type: 'text'; text: string } | { type: 'tool'; id: string }

/** Adds streamed text to the reply — to the current text piece, or a new one after a tool call. */
function appendTextPart(existing: MessagePart[] | undefined, text: string): MessagePart[] {
  const parts = existing ?? []
  const last = parts.at(-1)
  if (last?.type === 'text') return [...parts.slice(0, -1), { type: 'text', text: last.text + text }]
  return [...parts, { type: 'text', text }]
}

interface Message {
  id: string; role: 'user' | 'assistant'; content: string
  /** Agent replies with tool calls: the order things happened in. Older saved messages have none. */
  parts?: MessagePart[]
  isFinal: boolean; toolCalls?: ToolCall[]; fromCallLog?: boolean
  /** The agent's opening message, from the greeting settings. */
  isGreeting?: boolean
}
interface ImportedMeta { phone: string; date: string; duration: string }

/** One `data:` event of the /api/prompt-forge/chat stream. */
interface ChatChunk { text?: string; error?: string; toolCall?: any; toolResult?: any }

/** A stream event, or null for a malformed chunk. */
function parseChatChunk(payload: string): ChatChunk | null {
  try {
    const parsed = JSON.parse(payload)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null // malformed chunk
  }
}

/** The conversation with the new user message (none for a generated greeting), and the empty reply to stream into. */
function startTurn(userContent: string | null, historyBefore: Message[]): { history: Message[]; assistantMsg: Message } {
  const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', isFinal: false, toolCalls: [] }
  if (userContent === null) return { history: historyBefore, assistantMsg: { ...assistantMsg, isGreeting: true } }
  const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userContent, isFinal: true }
  return { history: [...historyBefore, userMsg], assistantMsg }
}

/** Reads the chat route's SSE stream: each useful chunk to `onChunk`, then `onDone` at [DONE]. */
async function readChatStream(body: ReadableStream<Uint8Array>, onChunk: (chunk: ChatChunk) => void, onDone: () => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const handleLine = (line: string) => {
    if (!line.startsWith('data: ')) return
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') {
      onDone()
      return
    }
    const chunk = parseChatChunk(payload)
    if (chunk && (chunk.error || chunk.text || chunk.toolCall || chunk.toolResult)) onChunk(chunk)
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(handleLine)
  }
}

/** The list with the message `id` replaced by `update(message)`. */
function updateMessage(messages: Message[], id: string, update: (m: Message) => Message): Message[] {
  return messages.map(m => (m.id === id ? update(m) : m))
}

const withToolResult = (tc: ToolCall, toolResult: any): ToolCall =>
  tc.id === toolResult.id ? { ...tc, result: toolResult.result, success: toolResult.success, duration_ms: toolResult.duration_ms, pending: false } : tc

/** The streaming reply with one stream event applied. Only called for events that carry something. */
function applyChatChunk(m: Message, { text, error, toolCall, toolResult }: ChatChunk): Message {
  if (error) return { ...m, content: error, isFinal: true }
  if (text) return { ...m, content: m.content + text, parts: appendTextPart(m.parts, text) }
  if (toolCall) {
    return {
      ...m,
      toolCalls: [...(m.toolCalls ?? []), { id: toolCall.id, name: toolCall.name, arguments: toolCall.arguments, pending: true }],
      parts: [...(m.parts ?? []), { type: 'tool', id: toolCall.id }],
    }
  }
  return { ...m, toolCalls: (m.toolCalls ?? []).map(tc => withToolResult(tc, toolResult)) }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatDuration(s: number): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

// Filled in by the voice backend on every call (utils/variable_substitution.py),
// so nobody sets them — the playground fills them the same way.
const SYSTEM_VARIABLES: Record<string, string> = {
  wcalling_number: 'Caller’s phone number — a test number here, as for web calls',
  wcurrent_time: 'Current time (IST)',
  wcurrent_date: 'Current date (IST)',
  wcurrent_day: 'Current day (IST)',
  wcontext_dropoff: 'Context summary for drop-off calls — empty when testing',
}
const isSystemVariable = (name: string) => name in SYSTEM_VARIABLES

/** The values the backend would use right now: "02:30 PM", "16 Nov 2025, Monday", IST. */
function systemVariableValues(now = new Date()): Record<string, string> {
  const ist = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', ...opts }).format(now)
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(now)
  const day = ist({ weekday: 'long' })
  return {
    wcalling_number: '+1234567890',
    wcurrent_time: time,
    wcurrent_date: `${ist({ day: '2-digit' })} ${ist({ month: 'short' })} ${ist({ year: 'numeric' })}, ${day}`,
    wcurrent_day: day,
    wcontext_dropoff: '',
  }
}

function substituteVariables(text: string, variables: Variable[]): string {
  const withUser = variables.reduce((t, v) => {
    if (!v.value || isSystemVariable(v.name)) return t
    return t.replaceAll(new RegExp(String.raw`\{\{\s*${v.name}\s*\}\}`, 'g'), v.value)
  }, text)
  const system = systemVariableValues()
  return withUser.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => (name in system ? system[name] : match))
}

function parseAgentConfig(json: string): ParsedConfig | null {
  try {
    const raw = JSON.parse(json)
    const c = raw.config ?? raw
    const llm = c.llm ?? {}
    const prompt = c.prompt ?? {}
    const toolsDef = c.advancedSettings?.tools?.tools ?? []
    return {
      llm: { provider: normalizeProvider(llm.provider), model: llm.model ?? '', temperature: llm.temperature ?? 0.7 },
      prompt: prompt.text ?? '',
      variables: (prompt.variables ?? []).map((v: any) => ({ name: v.name ?? '', value: v.value ?? '', description: v.description ?? '' })),
      tools: toolsDef.map((t: any) => ({
        id: t.id ?? crypto.randomUUID(), type: t.type ?? 'custom_function', name: t.name ?? '',
        description: t.config?.description ?? '', endpoint: t.config?.endpoint ?? '',
        method: t.config?.method ?? 'POST', headers: t.config?.headers ?? {}, body: t.config?.body ?? '',
        parameters: (t.config?.parameters ?? []).map((p: any) => ({ name: p.name ?? '', type: p.type ?? 'string', description: p.description ?? '', required: p.required ?? false })),
      })),
      greeting: readGreeting(c.conversationFlow?.firstMessageMode, c.conversationFlow?.customFirstMessage),
    }
  } catch { return null }
}

function turnsToMessages(turns: any[]): Message[] {
  const msgs: Message[] = []
  for (const turn of turns) {
    const userText = stripEod(turn.user_transcript)
    const agentText = stripEod(turn.agent_response)
    const toolCalls: ToolCall[] = (turn.tool_calls ?? []).map((tc: any) => ({
      name: tc.tool_name ?? tc.name ?? 'unknown_tool', arguments: tc.arguments,
      result: tc.result, success: tc.success !== false && tc.status !== 'error',
      duration_ms: tc.duration_ms ?? tc.execution_duration_ms,
    }))
    if (userText) msgs.push({ id: crypto.randomUUID(), role: 'user', content: userText, isFinal: true, fromCallLog: true })
    if (agentText || toolCalls.length > 0) msgs.push({ id: crypto.randomUUID(), role: 'assistant', content: agentText, isFinal: true, toolCalls, fromCallLog: true })
  }
  return msgs
}

const IMPORT_PAGE_SIZE = 15

type ImportRange = 'today' | '7d' | '30d' | 'all'
const IMPORT_RANGES: Array<{ value: ImportRange; label: string }> = [
  { value: 'today', label: 'Today' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: 'all', label: 'All time' },
]

/** yyyy-MM-dd bounds for a quick range (the call-logs query takes whole days). */
function importRangeDates(range: ImportRange): { from: string | null; to: string | null } {
  if (range === 'all') return { from: null, to: null }
  const day = (d: Date) => d.toLocaleDateString('en-CA')
  const to = new Date()
  const from = new Date()
  if (range === '7d') from.setDate(from.getDate() - 6)
  if (range === '30d') from.setDate(from.getDate() - 29)
  return { from: day(from), to: day(to) }
}

// Same query and filters as the Call Logs page.
async function fetchCallLogPage(agentId: string, page: number, filters: FilterOperation[], range: ImportRange) {
  const { preDistinctFilters, postDistinctFilters, distinctConfig } = extractFiltersAndDistinct(filters, agentId)
  // a filter on the date itself replaces the quick range, as on Call Logs
  const dates = filters.some(f => f.type === 'filter' && f.column === 'call_started_at') ? { from: null, to: null } : importRangeDates(range)
  const r = await fetch(`/api/agents/${agentId}/call-logs/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_agent_id: agentId, p_pre_distinct_filters: preDistinctFilters, p_post_distinct_filters: postDistinctFilters,
      p_select: 'id,call_id,customer_number,created_at,duration_seconds,call_ended_reason,wcall_event',
      p_order_by_column: 'created_at', p_order_ascending: false,
      p_limit: IMPORT_PAGE_SIZE + 1, p_offset: (page - 1) * IMPORT_PAGE_SIZE,
      p_distinct_column: distinctConfig?.column ?? null, p_distinct_json_field: distinctConfig?.jsonField ?? null, p_distinct_order: distinctConfig?.order ?? 'desc',
      p_date_from: dates.from, p_date_to: dates.to, p_user_clerk_id: null, p_user_email: null,
    }),
  })
  const { data, error } = await r.json()
  if (error) throw new Error(String(error))
  const filtered = (data ?? []).filter((c: any) => c.wcall_event !== 'call_started')
  return { items: filtered.slice(0, IMPORT_PAGE_SIZE), hasNext: filtered.length > IMPORT_PAGE_SIZE }
}

const stripEod = (text: string | null | undefined) => (text ?? '').replaceAll(/<(?:eod)\s*\/>/gi, '').trim()

// The import dialog's right side: the selected call's conversation.
function CallPreview({ selectedId, loading, turns }: Readonly<{ selectedId: string | null; loading: boolean; turns: any[] | null }>) {
  if (!selectedId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><Phone className="w-4 h-4 text-gray-300 dark:text-gray-600" /></div>
        <p className="text-xs text-muted-foreground">Select a call to preview</p>
      </div>
    )
  }
  if (loading) {
    return <div className="flex items-center justify-center h-full gap-2 text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading preview…</div>
  }
  if (turns?.length === 0) {
    return <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center"><p className="text-xs text-muted-foreground">No transcript data for this call.</p></div>
  }
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
      {(turns ?? []).map((turn: any) => {
        const userText = stripEod(turn.user_transcript)
        const agentText = stripEod(turn.agent_response)
        return (
          <div key={turn.id} className="space-y-2">
            {userText && <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-xs leading-relaxed">{userText}</div></div>}
            {agentText && <div className="flex justify-start"><div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-card text-foreground border border-border px-3 py-2 text-xs leading-relaxed">{agentText}</div></div>}
          </div>
        )
      })}
    </div>
  )
}

function buildImportPageItems(current: number, maxKnown: number, hasNext: boolean): (number | '…')[] {
  const last = hasNext ? maxKnown + 1 : maxKnown
  const items: (number | '…')[] = []
  const add = (v: number | '…') => { if (!items.includes(v)) items.push(v) }
  add(1)
  if (current > 3) add('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(last - 1, current + 1); i++) add(i)
  if (current < last - 2) add('…')
  if (last > 1) add(last)
  return items
}

function extractToolsFromAssistant(assistant: any): AgentTool[] {
  // assistant is the raw API response: tools live at assistant.tools (not advancedSettings)
  const toolsDef: any[] = assistant?.tools ?? []
  return toolsDef
    .filter((t: any) => t.type === 'custom_function')
    .map((t: any) => ({
      id: crypto.randomUUID(),
      type: t.type ?? 'custom_function',
      name: t.name ?? '',
      description: t.description ?? '',
      endpoint: t.api_url ?? '',
      method: t.http_method ?? 'POST',
      headers: t.headers ?? {},
      body: t.custom_payload ?? '',
      parameters: (t.parameters ?? []).map((p: any) => ({
        name: p.name ?? '',
        type: p.type ?? 'string',
        description: p.description ?? '',
        required: p.required ?? false,
      })),
    }))
}

// ─── Guard ────────────────────────────────────────────────────────────────────

function SessionDetailGuard() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectid as string
  const agentId = params.agentid as string
  const sessionId = params.sessionid as string
  const { canAccessPromptForge, isLoading } = useMemberVisibility(projectId)

  // Load the session while the permission check is still running — the
  // session API checks access itself, so there's nothing to wait for.
  if (!isLoading && !canAccessPromptForge) {
    return (
      <div className="h-screen bg-muted/50 flex items-center justify-center">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full text-center shadow-sm mx-4">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
            Prompt Forge requires{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">promptforge: true</code>{' '}
            in your project permissions.
          </p>
          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => router.replace(`/${projectId}/agents/${agentId}`)}>
            Go back
          </Button>
        </div>
      </div>
    )
  }
  return <SessionDetailLoader projectId={projectId} agentId={agentId} sessionId={sessionId} />
}

// ─── Loader ───────────────────────────────────────────────────────────────────

function SessionDetailLoader({ projectId, agentId, sessionId }: { projectId: string; agentId: string; sessionId: string }) {
  const router = useRouter()
  // ?v=3 opens that saved version, read-only (what a shared link points to)
  const viewVersion = Number(useSearchParams().get('v')) || null
  const [session, setSession] = useState<any>(null)
  const [version, setVersion] = useState<any>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const { data: agentRows, isLoading: agentLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, display_name, agent_type, configuration, field_extractor_prompt',
    filters: [{ column: 'id', operator: 'eq', value: agentId }],
    limit: 1,
    auth: { agentId },
  })
  const agentRow = agentRows?.[0]
  const pipecatAgentId = agentRow?.configuration?.pipecat_agent_id as string | undefined
  // Detect pipecat by config key — agent_type may not be standardized across older agents
  const isPipecat = !!pipecatAgentId || agentRow?.agent_type === 'pipecat_agent'

  // LiveKit/pype agent name — empty for pipecat so useAgentConfig stays disabled
  const agentNameWithId = useMemo(() => {
    if (isPipecat || !agentRow?.name || !agentId) return ''
    return `${agentRow.name}_${agentId.replaceAll('-', '_')}`
  }, [agentRow, agentId, isPipecat])

  const { data: agentConfig, isLoading: configLoading } = useAgentConfig(agentNameWithId, agentRow?.name ?? '')

  const { data: pipecatAgent, isLoading: pipecatConfigLoading } = useQuery({
    queryKey: ['pipecat-agent-forge', pipecatAgentId],
    queryFn: async () => {
      const res = await fetch(`/api/pipecat/agents/${pipecatAgentId}`)
      const json = await res.json()
      return json.data ?? null
    },
    enabled: isPipecat && !!pipecatAgentId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    let cancelled = false
    setSessionLoading(true)
    Promise.all([
      fetch(`/api/prompt-forge/sessions/${sessionId}`).then(r => r.json()),
      viewVersion ? fetch(`/api/prompt-forge/sessions/${sessionId}/versions/${viewVersion}`).then(r => r.json()) : Promise.resolve(null),
    ])
      .then(([data, v]) => {
        if (cancelled) return
        if (data?.error || v?.error) setNotFound(true)
        else { setSession(data); setVersion(v) }
        setSessionLoading(false)
      })
      .catch(() => { if (!cancelled) { setNotFound(true); setSessionLoading(false) } })
    return () => { cancelled = true }
  }, [sessionId, viewVersion])

  const isConfigLoading = isPipecat
    ? (!!pipecatAgentId && pipecatConfigLoading)
    : (!!agentNameWithId && configLoading)

  // What the real agent is configured with. Arrives on its own time — the agent
  // config server can be slow or down, so the page never waits for it.
  const agentDefaults = useMemo((): AgentDefaults | null => {
    if (isPipecat) {
      if (!pipecatAgent) return null
      return {
        prompt: pipecatAgent.prompt || '',
        model: pipecatAgent.llm_model || '',
        provider: normalizeProvider(pipecatAgent.llm_provider),
        temperature: null,
        // Pipecat has no mode: an opening message means the agent speaks first.
        greeting: pipecatAgent.opening_message
          ? { mode: 'assistant_speaks_first', text: pipecatAgent.opening_message }
          : { mode: 'assistant_waits_for_user', text: '' },
        tools: (pipecatAgent.custom_tools ?? []).map(pipecatToolToAgentTool),
        variables: variablesFromRecord(pipecatAgent.variables),
      }
    }
    const assistant = agentConfig?.agent?.assistant?.[0]
    if (!assistant) return null
    return {
      prompt: assistant.prompt || '',
      model: assistant.llm?.model || '',
      // the LLM block names its provider `provider` or `name` depending on the agent's age
      provider: normalizeProvider(assistant.llm?.provider ?? assistant.llm?.name),
      temperature: assistant.llm?.temperature ?? null,
      greeting: readGreeting(assistant.first_message_mode, assistant.first_message),
      tools: extractToolsFromAssistant(assistant),
      variables: variablesFromRecord(assistant.variables),
    }
  }, [isPipecat, pipecatAgent, agentConfig])

  if (sessionLoading || agentLoading) return <PageSkeleton />

  if (notFound) {
    return (
      <div className="h-screen bg-muted/50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-3">{viewVersion ? `Version ${viewVersion} of this session wasn't found.` : 'Session not found.'}</p>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => router.replace(`/${projectId}/agents/${agentId}/prompt-forge`)}>
            Back to sessions
          </Button>
        </div>
      </div>
    )
  }

  // A saved version shows exactly what was saved; otherwise the session's own
  // values, with the agent's config filling whatever the session hasn't set.
  const source = version ?? session
  const saved: SavedValues = {
    prompt: source.system_prompt || '',
    model: source.model || '',
    provider: source.provider ? normalizeProvider(source.provider) : '',
    temperature: source.temperature ?? null,
    greeting: isGreetingMode(source.first_message_mode) ? { mode: source.first_message_mode, text: source.first_message ?? '' } : null,
    tools: source.tools?.length > 0 ? source.tools : [],
  }
  const initial = mergeAgentDefaults(saved, version ? null : agentDefaults)
  const backendDown = !isPipecat && (agentConfig?.backendUnavailable ?? false)

  return (
    <ForgeUI
      projectId={projectId}
      agentId={agentId}
      agentName={agentDisplayName(agentRow)}
      sessionId={sessionId}
      sessionName={session.name || 'Untitled session'}
      initialPrompt={initial.prompt}
      initialModel={initial.model}
      initialProvider={initial.provider}
      initialTemperature={initial.temperature}
      initialVariables={initialVariablesFor(source.variables, !!version, agentDefaults?.variables)}
      initialTools={initial.tools}
      initialMessages={(source.messages ?? []).map((m: any) => ({ ...m, isFinal: true }))}
      initialGreeting={initial.greeting}
      backendDown={backendDown}
      saved={saved}
      agentDefaults={version ? null : agentDefaults}
      agentConfigLoading={!version && isConfigLoading && !agentDefaults}
      extractorFields={extractorKeys(agentRow)}
      canEdit={!!session.can_edit}
      ownerEmail={session.owner_email ?? null}
      initialVersions={session.versions ?? []}
      viewingVersion={version ? { version: version.version, createdBy: version.created_by_email, createdAt: version.created_at } : null}
    />
  )
}

// ─── Settings dialog ──────────────────────────────────────────────────────────

function SettingsDialog({ open, onClose, provider, onProviderChange, model, onModelChange, temperature, onTemperatureChange, availability, readOnly }: Readonly<{
  open: boolean; onClose: () => void
  provider: string; onProviderChange: (v: string) => void
  model: string; onModelChange: (v: string) => void
  temperature: number; onTemperatureChange: (v: number) => void
  /** Which providers this server can run (has their key); null while loading. */
  availability: Record<string, { available: boolean; reason?: string }> | null
  readOnly: boolean
}>) {
  const status = availability?.[provider]
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground">Model</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            The same choices as Agent Config, so test answers match the real agent. Applies to this session only.
          </DialogDescription>
        </DialogHeader>
        <div className={cn('pt-1', readOnly && 'pointer-events-none opacity-60')}>
          <ModelSelector
            selectedProvider={provider}
            selectedModel={model}
            temperature={temperature}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
            onTemperatureChange={onTemperatureChange}
          />
        </div>
        {status && !status.available && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            {status.reason ?? 'This provider can’t run in Prompt Forge here.'} Pick another provider to test.
          </p>
        )}
        {readOnly && <p className="text-[11px] text-muted-foreground">Read-only — duplicate the session to change its model.</p>}
      </DialogContent>
    </Dialog>
  )
}

// ─── Config import dialog ─────────────────────────────────────────────────────

function ConfigImportDialog({ open, onClose, onApply }: {
  open: boolean; onClose: () => void; onApply: (config: ParsedConfig) => void
}) {
  const [json, setJson] = useState('')
  const [parsed, setParsed] = useState<ParsedConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleClose() { setJson(''); setParsed(null); setError(null); onClose() }

  function handleParse() {
    if (!json.trim()) return
    const result = parseAgentConfig(json.trim())
    if (!result) { setError('Invalid JSON or unrecognized config format.'); setParsed(null) }
    else { setError(null); setParsed(result) }
  }

  function handleApply() {
    if (parsed) { onApply(parsed); handleClose() }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground">Load Agent Config</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Paste your agent config JSON to fill in the prompt, variables, tools, model and greeting.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={json}
          onChange={e => { setJson(e.target.value); setParsed(null); setError(null) }}
          placeholder={'{\n  "version": "1.0",\n  "config": { ... }\n}'}
          rows={10}
          className="w-full text-xs font-mono rounded-lg border border-border bg-muted/50 text-foreground p-3 resize-none outline-none focus:border-border placeholder:text-muted-foreground leading-relaxed"
        />
        {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">{error}</p>}
        {parsed && (
          <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3 text-xs space-y-1">
            <p className="font-semibold text-success mb-1.5">Config parsed — ready to apply</p>
            <p className="text-success">✓ Prompt: {parsed.prompt.length.toLocaleString()} chars</p>
            <p className="text-success">✓ Variables: {parsed.variables.length} ({parsed.variables.map(v => v.name).join(', ')})</p>
            <p className="text-success">✓ Tools: {parsed.tools.length} ({parsed.tools.map(t => t.name).join(', ')})</p>
            {parsed.llm.model && <p className="text-success">✓ Model: {modelLabelFor(parsed.llm.provider, parsed.llm.model)} · temperature {parsed.llm.temperature}</p>}
            {parsed.greeting && <p className="text-success">✓ Greeting: {GREETING_MODES.find(m => m.value === parsed.greeting!.mode)?.label}</p>}
          </div>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleClose}>Cancel</Button>
          {!parsed
            ? <Button size="sm" className="h-8 text-xs" onClick={handleParse} disabled={!json.trim()}>Parse JSON</Button>
            : <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleApply}>Apply Config</Button>
          }
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Import call log dialog ───────────────────────────────────────────────────

function ImportLogDialog({ open, onClose, agentId, onImport, transcriptionFields }: Readonly<{
  open: boolean; onClose: () => void; agentId: string
  onImport: (messages: Message[], meta: ImportedMeta) => void
  /** The agent's extracted fields, offered in the filter builder. */
  transcriptionFields: string[]
}>) {
  const [filters, setFilters] = useState<FilterOperation[]>([])
  const [range, setRange] = useState<ImportRange>('7d')
  const [logs, setLogs] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [maxKnownPage, setMaxKnownPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewTurns, setPreviewTurns] = useState<any[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function goToPage(p: number) {
    setLoading(true); setError(null)
    try {
      const { items, hasNext } = await fetchCallLogPage(agentId, p, filters, range)
      setLogs(items); setPage(p); setHasNextPage(hasNext)
      setMaxKnownPage(prev => Math.max(prev, hasNext ? p + 1 : p))
      if (p === 1 && items.length > 0) handleSelectLog(items[0])
    } catch (e: any) { setError(e.message ?? 'Failed to load call logs') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!open || !agentId) return
    setLogs([]); setPage(1); setMaxKnownPage(1); setHasNextPage(false)
    setSelectedId(null); setPreviewTurns(null); setError(null)
    goToPage(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agentId, filters, range])

  async function handleSelectLog(log: any) {
    if (selectedId === log.id) return
    setSelectedId(log.id); setPreviewTurns(null); setPreviewLoading(true)
    try {
      const res = await fetch(`/api/prompt-forge/turns?session_id=${log.id}`)
      const turns = await res.json()
      setPreviewTurns(Array.isArray(turns) ? turns : [])
    } catch { setPreviewTurns([]) }
    finally { setPreviewLoading(false) }
  }

  function handleImport() {
    const log = logs.find(l => l.id === selectedId)
    if (!log || !previewTurns) return
    const messages = turnsToMessages(previewTurns)
    if (messages.length === 0) return
    onImport(messages, { phone: log.customer_number || 'Unknown caller', date: formatRelative(log.created_at), duration: log.duration_seconds ? formatDuration(log.duration_seconds) : '' })
    onClose()
  }

  const canImport = !!selectedId && Array.isArray(previewTurns) && previewTurns.length > 0 && !previewLoading
  const pageItems = buildImportPageItems(page, maxKnownPage, hasNextPage)
  const showPagination = maxKnownPage > 1 || hasNextPage

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 bg-card border-border overflow-hidden flex flex-col" style={{ height: '75vh', maxHeight: 640 }}>
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="text-sm font-semibold text-foreground">Import Call Log</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">Select a call to preview, then import it to replay with a different prompt.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 border-r border-border/60 flex flex-col overflow-hidden">
            {/* The Call Logs filters, plus a quick date range */}
            <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-border/60">
              <Select value={range} onValueChange={v => setRange(v as ImportRange)}>
                <SelectTrigger className="h-8 w-[118px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMPORT_RANGES.map(r => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <CallFilter
                onFiltersChange={setFilters}
                onClear={() => setFilters([])}
                initialFilters={filters}
                availableTranscriptionFields={transcriptionFields}
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && <div className="flex items-center justify-center py-12 gap-2 text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>}
              {!loading && error && <div className="px-4 py-3 text-xs text-destructive">{error}</div>}
              {!loading && !error && logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 px-4 text-center">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><Phone className="w-4 h-4 text-muted-foreground" /></div>
                  <p className="text-xs text-muted-foreground">{filters.length || range !== 'all' ? 'No calls match — try a wider range or fewer filters' : 'No completed calls found'}</p>
                </div>
              )}
              {!loading && logs.map(log => (
                <button key={log.id} onClick={() => handleSelectLog(log)}
                  className={cn('w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-border/60 last:border-0 transition-colors',
                    selectedId === log.id ? 'bg-primary/10' : 'hover:bg-muted')}
                >
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
                    selectedId === log.id ? 'bg-primary/15 border-primary/30' : 'bg-muted border-border')}>
                    <Phone className={cn('w-3 h-3', selectedId === log.id ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-medium truncate', selectedId === log.id ? 'text-primary' : 'text-foreground')}>
                      {log.customer_number || 'Unknown caller'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{formatRelative(log.created_at)}</span>
                      {log.duration_seconds > 0 && <><span className="text-gray-300 dark:text-gray-700">·</span><span className="text-[10px] text-gray-400 dark:text-gray-600">{formatDuration(log.duration_seconds)}</span></>}
                      {log.call_ended_reason && <><span className="text-gray-300 dark:text-gray-700">·</span><span className="text-[10px] text-gray-400 dark:text-gray-600 capitalize">{log.call_ended_reason.replaceAll('_', ' ')}</span></>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {showPagination && (
              <div className="shrink-0 flex items-center justify-center gap-0.5 py-2 border-t border-border/60 bg-card">
                <Button variant="ghost" size="sm" className="h-9 w-9 sm:h-7 sm:w-7 p-0 text-muted-foreground" disabled={page === 1 || loading} onClick={() => goToPage(page - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {pageItems.map((item) =>
                  item === '…'
                    ? <span key="ellipsis" className="w-6 text-center text-xs text-muted-foreground select-none">…</span>
                    : <Button key={item} variant={item === page ? 'default' : 'ghost'} size="sm" className={cn('h-9 w-9 sm:h-7 sm:w-7 p-0 text-xs font-medium', item === page && 'pointer-events-none')} disabled={loading} onClick={() => goToPage(item)}>{item}</Button>
                )}
                <Button variant="ghost" size="sm" className="h-9 w-9 sm:h-7 sm:w-7 p-0 text-muted-foreground" disabled={!hasNextPage || loading} onClick={() => goToPage(page + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden bg-muted/50">
            <CallPreview selectedId={selectedId} loading={previewLoading} turns={previewTurns} />
          </div>
        </div>
        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border/60 bg-card">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="h-8 text-xs" onClick={handleImport} disabled={!canImport}>Import this call</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tools sheet ──────────────────────────────────────────────────────────────

const TOOL_TYPE_STYLES: Record<string, string> = {
  custom_function:  'bg-primary/10 text-primary border-primary/30',
  transfer_call:    'bg-warning/10 text-warning border-warning/30',
  knowledge_search: 'bg-success/10 text-success border-success/30',
}

/** The parts of a tool someone can change here — to tell an edited tool from the agent's. */
const toolShape = (t: AgentTool) => JSON.stringify({
  d: t.description, e: t.endpoint ?? '', m: t.method ?? 'POST', h: t.headers ?? {}, b: t.body ?? '',
  p: t.parameters, mock: t.mock?.enabled ? t.mock : null,
})

const FIELD = 'w-full rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-blue-400 dark:focus:border-blue-500 disabled:opacity-60'
const FIELD_LABEL = 'text-[10px] font-medium text-muted-foreground mb-1'

// One tool, editable in place (owner only). Changes apply to the next message
// and are saved with the session; they never touch the agent's real config.
function ToolCard({ tool, onChange, readOnly, original, onReset }: Readonly<{
  tool: AgentTool; onChange: (t: AgentTool) => void; readOnly: boolean
  /** The agent's own version of this tool, when known. */
  original?: AgentTool
  onReset: () => void
}>) {
  const [expanded, setExpanded] = useState(false)
  const [headersText, setHeadersText] = useState(() => JSON.stringify(tool.headers ?? {}, null, 2))
  const [headersError, setHeadersError] = useState(false)
  const typeStyle = TOOL_TYPE_STYLES[tool.type] ?? TOOL_TYPE_STYLES.custom_function
  const set = (patch: Partial<AgentTool>) => onChange({ ...tool, ...patch })
  // Rows need a stable key that survives edits (the objects are replaced on every
  // keystroke, and a changing key would drop focus mid-typing).
  const paramKeys = useRef<string[]>([])
  const paramKey = (i: number) => (paramKeys.current[i] ??= crypto.randomUUID())
  const removeParam = (i: number) => {
    paramKeys.current.splice(i, 1)
    set({ parameters: tool.parameters.filter((_, j) => j !== i) })
  }
  const setParam = (i: number, patch: Partial<ToolParam>) => set({ parameters: tool.parameters.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const mock = tool.mock ?? { enabled: false, response: '', success: true }
  const mockInvalid = mock.enabled && mock.response.trim().startsWith('{') && (() => { try { JSON.parse(mock.response); return false } catch { return true } })()
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-start gap-3 p-3 bg-muted/50 hover:bg-muted text-left transition-colors">
        <Zap className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-mono font-medium text-foreground">{tool.name}</span>
            <span className={cn('text-[10px] px-1.5 py-px rounded border font-medium shrink-0', typeStyle)}>{tool.type.replaceAll('_', ' ')}</span>
            {mock.enabled && <span className="text-[10px] px-1.5 py-px rounded border font-medium shrink-0 border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-300">mocked</span>}
            {original && toolShape(original) !== toolShape(tool) && <span className="text-[10px] px-1.5 py-px rounded border font-medium shrink-0 border-warning/40 text-warning">edited</span>}
          </div>
          {tool.description && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{tool.description}</p>}
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="border-t border-border divide-y divide-border/60">
          {!readOnly && original && toolShape(original) !== toolShape(tool) && (
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50/60 dark:bg-amber-900/10">
              <span className="text-[11px] text-warning">Changed from the agent&apos;s version</span>
              <button className="inline-flex items-center gap-1 text-[11px] font-medium text-warning hover:underline" onClick={onReset}>
                <RotateCcw className="w-3 h-3" />Reset to agent&apos;s version
              </button>
            </div>
          )}
          {/* Mock response — the quickest way to test a flow without the real API */}
          <div className="px-3 py-2.5 space-y-2 bg-violet-50/50 dark:bg-violet-900/10">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
              <input type="checkbox" checked={mock.enabled} disabled={readOnly} onChange={e => set({ mock: { ...mock, enabled: e.target.checked } })} />
              <span>Mock response — reply with this instead of calling the endpoint</span>
            </label>
            {mock.enabled && (
              <>
                <textarea
                  value={mock.response}
                  disabled={readOnly}
                  onChange={e => set({ mock: { ...mock, response: e.target.value } })}
                  rows={5}
                  placeholder={'{ "slots": [] }'}
                  className={cn(FIELD, 'font-mono', mockInvalid && 'border-red-400')}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <input type="checkbox" checked={mock.success === false} disabled={readOnly} onChange={e => set({ mock: { ...mock, success: !e.target.checked } })} />
                    <span>Treat as a failed call</span>
                  </label>
                  {mockInvalid && <span className="text-[11px] text-destructive">Not valid JSON — it will be sent as plain text</span>}
                </div>
              </>
            )}
          </div>
          <div className="px-3 py-2.5">
            <p className={FIELD_LABEL}>Description</p>
            <textarea value={tool.description} disabled={readOnly} onChange={e => set({ description: e.target.value })} rows={3} className={FIELD} />
          </div>
          {tool.type === 'custom_function' && (
            <div className="px-3 py-2.5 space-y-2">
              <div>
                <p className={FIELD_LABEL}>Endpoint</p>
                <div className="flex gap-1.5">
                  <select value={tool.method ?? 'POST'} disabled={readOnly} onChange={e => set({ method: e.target.value })} className={cn(FIELD, 'w-24 shrink-0')}>
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                  </select>
                  <input value={tool.endpoint ?? ''} disabled={readOnly} onChange={e => set({ endpoint: e.target.value })} className={cn(FIELD, 'font-mono')} />
                </div>
              </div>
              <div>
                <p className={FIELD_LABEL}>Headers (JSON)</p>
                <textarea
                  value={headersText}
                  disabled={readOnly}
                  rows={3}
                  onChange={e => {
                    setHeadersText(e.target.value)
                    try { set({ headers: JSON.parse(e.target.value || '{}') }); setHeadersError(false) } catch { setHeadersError(true) }
                  }}
                  className={cn(FIELD, 'font-mono', headersError && 'border-red-400')}
                />
              </div>
              {tool.method !== 'GET' && (
                <div>
                  <p className={FIELD_LABEL}>Body — <span className="normal-case">__name__ is replaced by that parameter</span></p>
                  <textarea value={tool.body ?? ''} disabled={readOnly} rows={4} onChange={e => set({ body: e.target.value })} className={cn(FIELD, 'font-mono')} />
                </div>
              )}
            </div>
          )}
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className={FIELD_LABEL}>Parameters</p>
              {!readOnly && (
                <button className="text-[11px] text-primary hover:underline"
                  onClick={() => set({ parameters: [...tool.parameters, { name: '', type: 'string', description: '', required: false }] })}>
                  + Add
                </button>
              )}
            </div>
            <div className="space-y-2">
              {tool.parameters.map((p, i) => (
                <div key={paramKey(i)} className="rounded-md border border-border/60 p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input value={p.name} disabled={readOnly} placeholder="name" onChange={e => setParam(i, { name: e.target.value })} className={cn(FIELD, 'font-mono text-primary')} />
                    <select value={p.type} disabled={readOnly} onChange={e => setParam(i, { type: e.target.value })} className={cn(FIELD, 'w-24 shrink-0')}>
                      {['string', 'number', 'integer', 'boolean'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <input type="checkbox" checked={p.required} disabled={readOnly} onChange={e => setParam(i, { required: e.target.checked })} />req
                    </label>
                    {!readOnly && (
                      <button aria-label="Remove parameter" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeParam(i)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input value={p.description} disabled={readOnly} placeholder="description — tells the model what to put here" onChange={e => setParam(i, { description: e.target.value })} className={FIELD} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolsSheet({ open, onClose, tools, onChange, readOnly, agentTools }: Readonly<{
  open: boolean; onClose: () => void; tools: AgentTool[]; onChange: (tools: AgentTool[]) => void; readOnly: boolean
  /** The agent's own tools (null while its config hasn't loaded) — what Reset goes back to. */
  agentTools: AgentTool[] | null
}>) {
  // Bumped on reset so a card drops what's typed in it (e.g. half-written headers).
  const [resetCount, setResetCount] = useState(0)
  const originalOf = (t: AgentTool) => agentTools?.find(a => a.name === t.name)
  const anyEdited = !!agentTools && (
    tools.length !== agentTools.length || tools.some(t => { const o = originalOf(t); return !o || toolShape(o) !== toolShape(t) })
  )
  const reset = (next: AgentTool[]) => { onChange(next); setResetCount(n => n + 1) }
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[520px] sm:max-w-[520px] bg-card border-border overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />Tools ({tools.length})
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {readOnly
              ? 'Read-only. Custom functions call their endpoints (or their mock response); transfer and knowledge tools are mocked.'
              : 'Edit anything here to test — changes apply to the next message and save with this session, not the agent. Use “Mock response” to test a reply without calling the real API.'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 mt-2">
          {!readOnly && anyEdited && (
            <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2">
              <span className="text-xs text-warning">These tools differ from the agent&apos;s.</span>
              <button className="inline-flex items-center gap-1 text-xs font-medium text-warning hover:underline"
                onClick={() => reset((agentTools ?? []).map(a => ({ ...a, id: crypto.randomUUID() })))}>
                <RotateCcw className="w-3 h-3" />Reset all to agent&apos;s tools
              </button>
            </div>
          )}
          {tools.map(tool => (
            <ToolCard
              key={`${tool.id}-${resetCount}`}
              tool={tool}
              readOnly={readOnly}
              original={originalOf(tool)}
              onChange={t => onChange(tools.map(x => (x.id === t.id ? t : x)))}
              onReset={() => { const o = originalOf(tool); if (o) reset(tools.map(x => (x.id === tool.id ? { ...o, id: tool.id } : x))) }}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Tool call block ──────────────────────────────────────────────────────────

function ToolCallBlock({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  if (tc.pending) {
    return (
      <div className="mt-1.5 rounded-lg border border-warning/30 bg-warning/10 text-xs overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Loader2 className="w-3 h-3 text-warning animate-spin shrink-0" />
          <span className="font-mono font-medium text-warning flex-1 truncate">{tc.name}</span>
          <span className="text-[10px] text-warning">calling…</span>
        </div>
      </div>
    )
  }
  const ok = tc.success !== false
  return (
    <div className="mt-1.5 rounded-lg border border-border overflow-hidden text-xs bg-card">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/50 hover:bg-muted text-left transition-colors">
        <Zap className="w-3 h-3 text-warning shrink-0" />
        <span className="font-mono font-medium text-foreground flex-1 truncate">{tc.name}</span>
        {tc.duration_ms != null && <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{tc.duration_ms}ms</span>}
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', ok ? 'bg-green-500' : 'bg-red-500')} />
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="border-t border-border divide-y divide-border/60">
          {tc.arguments != null && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Arguments</p>
              <pre className="text-[11px] text-foreground font-mono whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-auto">
                {typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments, null, 2)}
              </pre>
            </div>
          )}
          {tc.result != null && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Result</p>
              <pre className="text-[11px] text-foreground font-mono whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-auto">
                {typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Variable panel ───────────────────────────────────────────────────────────

function VariablePanel({ variables, onChange, disabled, autoFilled = [] }: Readonly<{ variables: Variable[]; onChange: (v: Variable[]) => void; disabled?: boolean; autoFilled?: string[] }>) {
  // closed by default — the prompt and greeting matter more at a glance
  const [open, setOpen] = useState(false)
  if (variables.length === 0 && autoFilled.length === 0) return null
  return (
    <div className="shrink-0 border-t border-border">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 h-8 hover:bg-muted transition-colors">
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          Variables ({variables.length})
        </span>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 max-h-52 overflow-y-auto space-y-1.5">
          {variables.map((v, i) => (
            <div key={v.name} className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[11px] font-mono text-primary w-36 shrink-0 truncate cursor-default">{`{{${v.name}}}`}</span>
                </TooltipTrigger>
                {v.description && <TooltipContent side="left" className="text-xs max-w-[200px]">{v.description}</TooltipContent>}
              </Tooltip>
              <input
                value={v.value}
                onChange={e => { const updated = [...variables]; updated[i] = { ...v, value: e.target.value }; onChange(updated) }}
                placeholder={v.description || 'value…'}
                disabled={disabled}
                className="flex-1 h-6 text-xs px-2 rounded border border-border bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
              />
            </div>
          ))}
          {autoFilled.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="pt-1 text-[10.5px] leading-relaxed text-muted-foreground cursor-default">
                  Filled in automatically: <span className="font-mono">{autoFilled.map(n => `{{${n}}}`).join(', ')}</span>
                </p>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[280px]">
                {autoFilled.map(n => <div key={n}><span className="font-mono">{n}</span> — {SYSTEM_VARIABLES[n]}</div>)}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Greeting panel ───────────────────────────────────────────────────────────

function GreetingPanel({ greeting, onChange, disabled }: Readonly<{ greeting: Greeting; onChange: (g: Greeting) => void; disabled?: boolean }>) {
  const [open, setOpen] = useState(true)
  const current = GREETING_MODES.find(m => m.value === greeting.mode)
  return (
    <div className="shrink-0 border-t border-border">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 h-8 hover:bg-muted transition-colors">
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
          <MessageSquareText className="w-3 h-3" />
          Greeting · <span className="text-muted-foreground font-normal">{current?.label}</span>
        </span>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 space-y-2">
          <Select value={greeting.mode} onValueChange={v => onChange({ ...greeting, mode: v as GreetingMode })} disabled={disabled}>
            {/* the trigger shows just the mode; its explanation lives in the menu */}
            <SelectTrigger className="h-7 w-full text-xs bg-card border-border"><SelectValue>{current?.label}</SelectValue></SelectTrigger>
            <SelectContent>
              {GREETING_MODES.map(m => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  <span className="flex flex-col">
                    <span>{m.label}</span>
                    <span className="text-[11px] text-muted-foreground">{m.hint}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {greeting.mode === 'assistant_speaks_first' && (
            <VariableTextarea
              value={greeting.text}
              onChange={text => onChange({ ...greeting, text })}
              disabled={disabled}
              placeholder="Hello! How can I help you today?  ({{variables}} work here too)"
              className="rounded border-border"
              style={{ height: '72px', minHeight: '72px' }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Session name editor (for header) ────────────────────────────────────────

function SessionNameEditor({ name, onSave }: { name: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setValue(name) }, [name])

  function startEdit() { setValue(name); setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }

  function commit() {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed && trimmed !== name) onSave(trimmed)
    else setValue(name)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setValue(name) } }}
        className="text-sm font-medium bg-card border border-blue-400 dark:border-blue-500 rounded px-2 py-0.5 text-foreground outline-none min-w-0 max-w-[200px]"
      />
    )
  }

  return (
    <button onClick={startEdit} className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate max-w-[200px]" title="Click to rename">
      {name || 'Untitled session'}
    </button>
  )
}

// ─── Main forge UI ────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved'
type DraftState = 'saved' | 'pending' | 'saving' | 'error'
const DRAFT_SAVE_DELAY_MS = 1500

const DRAFT_LABELS: Record<DraftState, string> = {
  saved: 'Draft saved',
  pending: 'Unsaved changes',
  saving: 'Saving draft…',
  error: 'Couldn’t save draft — retry',
}

function ReadOnlyNotice({ viewingVersion, canEdit, ownerEmail }: Readonly<{
  viewingVersion: { version: number; createdBy: string | null; createdAt: string } | null
  canEdit: boolean
  ownerEmail: string | null
}>) {
  if (viewingVersion && canEdit) {
    return <>Saved version <b>v{viewingVersion.version}</b> · {formatRelative(viewingVersion.createdAt)} — versions are snapshots and don&apos;t change. Edit in your draft, or restore this version into it.</>
  }
  if (viewingVersion) {
    return <>Viewing <b>v{viewingVersion.version}</b>{viewingVersion.createdBy ? ` saved by ${viewingVersion.createdBy}` : ''} · {formatRelative(viewingVersion.createdAt)} — read-only. You can still chat to try it.</>
  }
  return <>Read-only — this session belongs to <b>{ownerEmail ?? 'someone else'}</b>. You can chat to try it; duplicate it to make changes.</>
}

function promptPlaceholder(agentConfigLoading: boolean, backendDown: boolean): string {
  if (agentConfigLoading) return 'Loading the agent’s prompt…'
  if (backendDown) return 'Agent config server is unreachable — paste your system prompt here…'
  return 'System prompt will auto-populate from your agent config…'
}

function saveButtonLabel(state: SaveState, latestVersion: number | undefined): string {
  if (state === 'saving') return 'Saving…'
  if (state === 'saved') return `Saved v${latestVersion ?? ''}`
  return 'Save'
}

// Prompt panel width as a share of the page: a usable prompt editor at the low
// end, and enough room left for the chat at the high end.
const DEFAULT_LEFT_PCT = 42
const MIN_LEFT_PCT = 25
const MAX_LEFT_PCT = 65
const SPLIT_KEY = 'promptForge:promptPanelPct'

// The header's main action: your own saved version opens the draft (versions
// never change, so editing happens in your draft); someone else's session can
// be duplicated; your draft is saved as a new version.
function HeaderAction({ viewingVersion, canEdit, readOnly, onRestore, onOpenDraft, onDuplicate, draftState, onDraftRetry, saveState, latestVersion, onSave }: Readonly<{
  viewingVersion: boolean; canEdit: boolean; readOnly: boolean
  onRestore: () => void; onOpenDraft: () => void; onDuplicate: () => void
  draftState: DraftState; onDraftRetry: () => void
  saveState: SaveState; latestVersion: number | undefined; onSave: () => void
}>) {
  if (viewingVersion && canEdit) {
    return (
      <>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-2 ml-1 text-muted-foreground hover:text-foreground" onClick={onRestore}>
          <RotateCcw className="w-3 h-3" />Restore into draft
        </Button>
        <Button size="sm" className="h-7 gap-1.5 text-xs px-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300" onClick={onOpenDraft}>
          Open draft
        </Button>
      </>
    )
  }
  if (readOnly) {
    return (
      <Button size="sm" className="h-7 gap-1.5 text-xs px-3 ml-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300" onClick={onDuplicate}>
        <CopyPlus className="w-3 h-3" />Duplicate to edit
      </Button>
    )
  }
  return (
    <>
      <DraftStatus state={draftState} onRetry={onDraftRetry} />
      <SaveVersionButton state={saveState} latestVersion={latestVersion} onSave={onSave} />
    </>
  )
}

/** Auto-save status of the draft (versions are separate — that's the Save button). */
function DraftStatus({ state, onRetry }: Readonly<{ state: DraftState; onRetry: () => void }>) {
  if (state === 'error') {
    return <button type="button" onClick={onRetry} className="text-[11px] text-destructive hover:underline mr-1">{DRAFT_LABELS.error}</button>
  }
  return (
    <span className="text-[11px] text-muted-foreground mr-1 flex items-center gap-1" aria-live="polite">
      {state === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
      {state === 'saved' && <Check className="w-3 h-3" />}
      {DRAFT_LABELS[state]}
    </span>
  )
}

const SAVE_ICONS: Record<SaveState, React.ReactNode> = {
  saving: <Loader2 className="w-3 h-3 animate-spin" />,
  saved: <Check className="w-3 h-3" />,
  idle: <Save className="w-3 h-3" />,
}

function SaveVersionButton({ state, latestVersion, onSave }: Readonly<{ state: SaveState; latestVersion: number | undefined; onSave: () => void }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          className={cn(
            'h-7 gap-1.5 text-xs px-3 ml-1 transition-colors',
            state === 'saved'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300',
          )}
          onClick={onSave}
          disabled={state === 'saving'}
        >
          {SAVE_ICONS[state]}
          {saveButtonLabel(state, latestVersion)}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Your draft saves automatically. Save adds a new version — a snapshot of this prompt, settings, greeting and conversation you can share.</TooltipContent>
    </Tooltip>
  )
}

function versionsLabel(count: number): string {
  if (!count) return 'No versions'
  return count === 1 ? '1 version' : `${count} versions`
}

/** Saved versions: each Save is one; `onOpen(null)` opens the working draft. */
function VersionsMenu({ versions, viewingVersion, onOpen }: Readonly<{ versions: SessionVersion[]; viewingVersion: number | null; onOpen: (version: number | null) => void }>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2" disabled={versions.length === 0}>
          <History className="w-3 h-3" /><span>{versionsLabel(versions.length)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-xs">Saved versions</DropdownMenuLabel>
        <DropdownMenuItem className="text-xs" onClick={() => onOpen(null)}>
          <span className="flex-1">Working draft</span>{viewingVersion === null && <Check className="w-3 h-3" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {versions.map(v => (
          <DropdownMenuItem key={v.id} className="text-xs" onClick={() => onOpen(v.version)}>
            <span className="font-mono w-8 shrink-0">v{v.version}</span>
            <span className="flex-1 min-w-0 truncate text-muted-foreground">{formatRelative(v.created_at)}{v.created_by_email ? ` · ${v.created_by_email}` : ''}</span>
            {viewingVersion === v.version && <Check className="w-3 h-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Copies a link: to the open version (a fixed snapshot), else to the session's latest draft. */
function ShareButton({ copied, version, onShare }: Readonly<{ copied: boolean; version: number | null; onShare: () => void }>) {
  const hint = version
    ? `Copy a link to v${version} — a snapshot that won’t change`
    : 'Copy a link to this session — always shows the latest draft (read-only for others)'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2" onClick={onShare}>
          {copied ? <Check className="w-3 h-3 text-success" /> : <Link2 className="w-3 h-3" />}<span>{copied ? 'Copied' : 'Share'}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

/** Shown over the chat after a call log is imported. */
function ImportedBanner({ meta, onClose }: Readonly<{ meta: ImportedMeta; onClose: () => void }>) {
  return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20">
      <Phone className="w-3 h-3 text-primary shrink-0" />
      <span className="text-xs text-primary flex-1 min-w-0 truncate">
        <span className="font-medium">{meta.phone}</span>
        <span className="text-primary ml-1.5">· {meta.date}{meta.duration && ` · ${meta.duration}`}</span>
      </span>
      <span className="text-[10px] text-blue-400 dark:text-blue-600 shrink-0">Imported · edit prompt &amp; replay</span>
      <button onClick={onClose} aria-label="Dismiss" className="w-4 h-4 flex items-center justify-center rounded text-blue-400 hover:text-primary hover:bg-primary/15 transition-colors"><X className="w-3 h-3" /></button>
    </div>
  )
}

/** The message box: Enter sends, Shift+Enter is a new line, */
function MessageComposer({ inputRef, value, onChange, onSend, busy, blockedReason }: Readonly<{
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  value: string; onChange: (v: string) => void; onSend: () => void; busy: boolean
  /** Why the chosen model can't run here, if it can't. */
  blockedReason: string | null
}>) {
  const canSend = !!value.trim() && !busy
  return (
    <div className="shrink-0 px-4 pb-4 pt-3 border-t border-border/60 bg-card">
      {blockedReason && (
        <p className="mb-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning">
          {blockedReason} Choose another in the model settings to test.
        </p>
      )}
      {/* The whole box is the text field's hit area: a <label> around the
          textarea focuses it on a click anywhere outside the send button. */}
      <label className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5 focus-within:border-border focus-within:ring-1 focus-within:ring-gray-200 dark:focus-within:ring-gray-700 transition-all cursor-text">
        <span className="sr-only">Message</span>
        <textarea
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter' || e.shiftKey) return
            e.preventDefault()
            onSend()
          }}
          placeholder="Message…  (press / to jump here)"
          rows={1}
          className="flex-1 resize-none bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground outline-none border-none leading-5 max-h-28 overflow-y-auto caret-gray-900 dark:caret-gray-100 py-0"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            aria-label="Send"
            onClick={e => { e.stopPropagation(); onSend() }}
            disabled={!canSend}
            className={cn('w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
              canSend ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300' : 'bg-muted text-gray-300 cursor-not-allowed')}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </label>
      <div className="flex items-center mt-1.5 px-1">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1"><CornerDownLeft className="w-2.5 h-2.5" />Enter to send · Shift+Enter for new line</span>
      </div>
    </div>
  )
}

function ForgeUI({
  projectId, agentId, agentName, sessionId, sessionName: initialSessionName,
  initialPrompt, initialModel, initialProvider, initialTemperature,
  initialVariables, initialTools, initialMessages, initialGreeting, backendDown,
  saved, agentDefaults, agentConfigLoading, extractorFields,
  canEdit, ownerEmail, initialVersions, viewingVersion,
}: Readonly<{
  projectId: string; agentId: string; agentName: string
  sessionId: string; sessionName: string
  initialPrompt: string; initialModel: string; initialProvider: string
  initialTemperature: number; initialVariables: Variable[]; initialTools: AgentTool[]
  initialMessages: Message[]; initialGreeting: Greeting; backendDown: boolean
  saved: SavedValues
  /** The agent's config, once it arrives (null while loading, unavailable, or viewing a version). */
  agentDefaults: AgentDefaults | null
  agentConfigLoading: boolean
  /** The agent's extracted (disposition) fields, for the import filters. */
  extractorFields: string[]
  /** The caller owns this session (or it predates owners). */
  canEdit: boolean
  ownerEmail: string | null
  initialVersions: SessionVersion[]
  /** Set when a saved version is open — always read-only. */
  viewingVersion: { version: number; createdBy: string | null; createdAt: string } | null
}>) {
  const router = useRouter()
  // Others can chat to try the prompt, but only the owner changes it — and saved versions never change.
  const readOnly = !canEdit || !!viewingVersion
  const [sessionName, setSessionName] = useState(initialSessionName)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [systemPrompt, setSystemPrompt] = useState(initialPrompt)
  const [provider, setProvider] = useState<string>(initialProvider)
  const [model, setModel] = useState(initialModel || 'gpt-4o-mini')
  const [temperature, setTemperature] = useState(initialTemperature)
  const [variables, setVariables] = useState<Variable[]>(initialVariables)
  const [tools, setTools] = useState<AgentTool[]>(initialTools)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [configImportOpen, setConfigImportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [importedFrom, setImportedFrom] = useState<ImportedMeta | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [greeting, setGreeting] = useState<Greeting>(initialGreeting)
  const [versions, setVersions] = useState<SessionVersion[]>(initialVersions)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [availability, setAvailability] = useState<Record<string, { available: boolean; reason?: string }> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // The prompt / chat split, draggable between these bounds and remembered per browser.
  const splitRef = useRef<HTMLDivElement>(null)
  const [leftPct, setLeftPct] = useState(DEFAULT_LEFT_PCT)
  const splitLoaded = useRef(false)
  useEffect(() => {
    try { const v = Number(globalThis.localStorage?.getItem(SPLIT_KEY)); if (v >= MIN_LEFT_PCT && v <= MAX_LEFT_PCT) setLeftPct(v) } catch { /* not remembered */ }
    splitLoaded.current = true
  }, [])
  useEffect(() => {
    if (!splitLoaded.current) return
    try { globalThis.localStorage?.setItem(SPLIT_KEY, String(leftPct)) } catch { /* not remembered */ }
  }, [leftPct])
  const startResize = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const box = splitRef.current?.getBoundingClientRect()
    if (!box) return
    e.preventDefault()
    const move = (ev: PointerEvent) => {
      const pct = ((ev.clientX - box.left) / box.width) * 100
      setLeftPct(Math.round(Math.min(MAX_LEFT_PCT, Math.max(MIN_LEFT_PCT, pct)) * 10) / 10)
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // The agent's config can arrive after the page opened (its server is slow at
  // times). Fill in, once, whatever the session hasn't set and you haven't touched.
  const agentFilled = useRef(!!agentDefaults)
  useEffect(() => {
    if (!agentDefaults || agentFilled.current) return
    agentFilled.current = true
    const merged = mergeAgentDefaults(saved, agentDefaults)
    setSystemPrompt(p => p || merged.prompt)
    if (!saved.model) { setProvider(merged.provider); setModel(merged.model) }
    if (saved.temperature == null) setTemperature(merged.temperature)
    if (!saved.greeting) setGreeting(merged.greeting)
    if (!saved.tools.length) setTools(t => (t.length ? t : merged.tools))
    setVariables(v => (v.length ? v : agentDefaults.variables))
  }, [agentDefaults, saved])

  // Variables used in the prompt or greeting but not defined yet are listed
  // too (empty), so they can be filled in before testing.
  const shownVariables = useMemo(() => {
    const own = variables.filter(v => !isSystemVariable(v.name))
    const known = new Set(own.map(v => v.name))
    const used = usedVariableNames(systemPrompt, greeting.text)
    const missing = used
      .filter(n => !known.has(n) && !isSystemVariable(n))
      .map(name => ({ name, value: '', description: 'Used in the prompt — no value yet' }))
    return [...own, ...missing]
  }, [variables, systemPrompt, greeting.text])
  // system variables the prompt uses — mentioned in one small line, not editable rows
  const autoFilledVariables = useMemo(() => usedVariableNames(systemPrompt, greeting.text).filter(isSystemVariable), [systemPrompt, greeting.text])

  // The floating Ask Pi sees this draft and the test chat.
  usePiSurface({
    label: 'Prompt Forge',
    suggestions: PI_FORGE_SUGGESTIONS,
    getContext: () => ({
      surface: 'prompt_forge',
      agentId,
      systemPrompt,
      model,
      provider,
      greeting,
      tools: tools.map(t => (t.mock?.enabled ? `${t.name} (mocked)` : t.name)),
      variables: variables.map(v => ({ name: v.name, value: v.value })),
      transcript: messages.filter(m => m.isFinal).map(m => ({ role: m.role, content: m.content, tools: m.toolCalls?.map(tc => tc.name) })),
    }),
  })

  // "/" jumps to the message box, unless you're already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.closest('.monaco-editor'))) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    fetch(`/api/prompt-forge/providers?project_id=${projectId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(setAvailability)
      .catch(() => setAvailability(null))
  }, [projectId])

  const handleConfigApply = useCallback((config: ParsedConfig) => {
    if (config.prompt) setSystemPrompt(config.prompt)
    setVariables(config.variables)
    setTools(config.tools)
    if (config.llm.model) {
      setProvider(config.llm.provider)
      setModel(config.llm.model)
      setTemperature(config.llm.temperature)
    }
    if (config.greeting) setGreeting(config.greeting)
  }, [])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(systemPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [systemPrompt])

  const handleImport = useCallback((msgs: Message[], meta: ImportedMeta) => {
    setMessages(msgs); setImportedFrom(meta)
  }, [])

  const snapshot = useCallback(() => ({
    system_prompt: systemPrompt, variables, tools, model, provider, temperature,
    first_message_mode: greeting.mode, first_message: greeting.text,
    messages: messages.filter(m => m.isFinal).map(({ isFinal: _f, ...m }) => m),
  }), [systemPrompt, variables, tools, model, provider, temperature, greeting, messages])

  // ── Draft auto-save: the working draft is kept on the server as you go (never
  // a version — Save does that), so a refresh or a closed tab loses nothing.
  const draftBody = useMemo(() => JSON.stringify(snapshot()), [snapshot])
  const savedDraftRef = useRef(draftBody)
  const [draftState, setDraftState] = useState<DraftState>('saved')
  const [draftRetry, setDraftRetry] = useState(0)
  useEffect(() => {
    // wait for a reply to finish before saving the conversation
    if (readOnly || isStreaming || draftBody === savedDraftRef.current) return
    setDraftState('pending')
    const timer = setTimeout(() => {
      setDraftState('saving')
      fetch(`/api/prompt-forge/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: draftBody })
        .then(res => {
          if (!res.ok) throw new Error('save failed')
          savedDraftRef.current = draftBody
          setDraftState('saved')
        })
        .catch(() => setDraftState('error'))
    }, DRAFT_SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draftBody, readOnly, isStreaming, sessionId, draftRetry])

  // Leaving with a draft change not yet on the server: let the browser ask first.
  useEffect(() => {
    if (draftState === 'saved') return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    globalThis.addEventListener('beforeunload', warn)
    return () => globalThis.removeEventListener('beforeunload', warn)
  }, [draftState])

  // Save never overwrites: it adds the next version (prompt, settings, greeting
  // and this transcript) and you keep editing the draft.
  const handleSave = useCallback(async () => {
    if (saveState === 'saving' || readOnly) return
    setSaveState('saving'); setSaveError(null)
    try {
      const res = await fetch(`/api/prompt-forge/sessions/${sessionId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot()),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Save failed')
      setVersions(v => [body, ...v])
      // saving a version also brings the draft up to date on the server
      savedDraftRef.current = JSON.stringify(snapshot())
      setDraftState('saved')
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch (err: any) {
      setSaveError(err?.message ?? 'Save failed'); setSaveState('idle')
    }
  }, [saveState, readOnly, sessionId, snapshot])

  /** A copy of what's on screen, owned by you. */
  const handleDuplicate = useCallback(async () => {
    const res = await fetch('/api/prompt-forge/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, project_id: projectId, name: `${sessionName} (copy)`, ...snapshot() }),
    })
    const body = await res.json()
    if (res.ok && body?.id) router.push(`/${projectId}/agents/${agentId}/prompt-forge/${body.id}`)
    else setSaveError(body?.error ?? 'Could not duplicate')
  }, [agentId, projectId, sessionName, snapshot, router])

  /** Owner: make the open version the working draft again. */
  const handleRestore = useCallback(async () => {
    // replaces the draft, including anything not saved as a version yet
    if (!globalThis.confirm(`Replace your draft with v${viewingVersion?.version ?? ''}? Anything in the draft that isn't saved as a version will be lost.`)) return
    const res = await fetch(`/api/prompt-forge/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot()),
    })
    if (res.ok) router.push(`/${projectId}/agents/${agentId}/prompt-forge/${sessionId}`)
    else setSaveError((await res.json().catch(() => null))?.error ?? 'Could not restore')
  }, [sessionId, snapshot, router, projectId, agentId, viewingVersion])

  // The draft link always shows the latest work; on a saved version, share that version.
  const shareLink = useCallback(() => {
    const v = viewingVersion?.version
    const query = v ? `?v=${v}` : ''
    const url = `${globalThis.location.origin}/${projectId}/agents/${agentId}/prompt-forge/${sessionId}${query}`
    navigator.clipboard.writeText(url).catch(() => {
      // copying is best-effort; the link is still in the address bar
    })
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }, [viewingVersion, projectId, agentId, sessionId])

  const draftPath = `/${projectId}/agents/${agentId}/prompt-forge/${sessionId}`
  const openDraft = useCallback(() => router.push(draftPath), [router, draftPath])
  const openVersion = useCallback((v: number | null) => router.push(v ? `${draftPath}?v=${v}` : draftPath), [router, draftPath])

  const handleNameSave = useCallback(async (name: string) => {
    if (readOnly) return
    setSessionName(name)
    await fetch(`/api/prompt-forge/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }, [sessionId, readOnly])

  /** Updates one message in the chat. */
  const patchMessage = useCallback((id: string, update: (m: Message) => Message) => setMessages(prev => updateMessage(prev, id, update)), [])

  // One assistant reply. With no user message it's the opening greeting the
  // model writes itself (greeting mode "generated").
  const runTurn = useCallback(async (userContent: string | null, historyBefore: Message[]) => {
    if (isStreaming) return
    const { history, assistantMsg } = startTurn(userContent, historyBefore)
    const assistantId = assistantMsg.id
    const isGreeting = userContent === null
    setMessages([...history, assistantMsg])
    setImportedFrom(null)
    setIsStreaming(true)
    const historyForApi = history.map(m => ({ role: m.role, content: m.content }))
    const effectivePrompt = substituteVariables(systemPrompt, variables)
    try {
      const res = await fetch('/api/prompt-forge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, agentId,
          messages: historyForApi, systemPrompt: effectivePrompt, model, temperature, provider,
          tools: tools.length > 0 ? tools : undefined,
          generateGreeting: isGreeting,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        patchMessage(assistantId, m => ({ ...m, content: err.error ?? 'Error', isFinal: true }))
        return
      }
      if (!res.body) throw new Error('No response')
      await readChatStream(
        res.body,
        chunk => patchMessage(assistantId, m => applyChatChunk(m, chunk)),
        () => patchMessage(assistantId, m => ({ ...m, isFinal: true })),
      )
    } catch (err: any) {
      patchMessage(assistantId, m => ({ ...m, content: err?.message ?? 'Network error', isFinal: true }))
    } finally { setIsStreaming(false) }
  }, [isStreaming, systemPrompt, variables, model, temperature, provider, tools, projectId, agentId, patchMessage])

  const sendMessage = useCallback((userContent: string, historyBefore: Message[]) => runTurn(userContent, historyBefore), [runTurn])

  // ── Greeting: how a fresh conversation starts, exactly as the agent config says.
  const greetingMessage = useMemo((): Message | null => {
    if (greeting.mode !== 'assistant_speaks_first' || !greeting.text.trim()) return null
    return { id: 'greeting', role: 'assistant', content: substituteVariables(greeting.text, variables), isFinal: true, isGreeting: true }
  }, [greeting, variables])

  /** Starts a new conversation: the greeting first when the agent speaks first. */
  const startConversation = useCallback(() => {
    setImportedFrom(null)
    if (greeting.mode === 'assistant_speaks_with_generated') {
      runTurn(null, []).catch(() => {}) // runTurn reports its own errors in the chat
      return
    }
    setMessages(greetingMessage ? [greetingMessage] : [])
  }, [greeting.mode, greetingMessage, runTurn])

  // Until the user has written anything, the conversation follows the greeting
  // settings (and picks up edits to the greeting text or variables).
  const conversationStarted = messages.some(m => m.role === 'user' || (m.role === 'assistant' && !m.isGreeting))
  useEffect(() => {
    if (conversationStarted || viewingVersion || isStreaming) return
    if (greeting.mode === 'assistant_speaks_with_generated') return
    setMessages(greetingMessage ? [greetingMessage] : [])
  }, [conversationStarted, viewingVersion, isStreaming, greeting.mode, greetingMessage])

  const handleSend = useCallback(() => {
    if (!input.trim()) return
    const content = input.trim(); setInput(''); inputRef.current?.focus()
    sendMessage(content, messages)
  }, [input, messages, sendMessage])

  const handleReplay = useCallback((messageIndex: number) => {
    if (isStreaming) return
    const target = messages[messageIndex]
    const userIdx = target.role === 'user' ? messageIndex : messageIndex - 1
    const userMsg = messages[userIdx]
    if (!userMsg || userMsg.role !== 'user') return
    sendMessage(userMsg.content, messages.slice(0, userIdx))
  }, [isStreaming, messages, sendMessage])

  const modelLabel = useMemo(() => modelLabelFor(provider, model), [provider, model])
  const providerBlocked = availability?.[provider]?.available === false

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-screen flex flex-col bg-card overflow-hidden">

        {/* ── Topbar ── */}
        <header className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-border bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => router.push(`/${projectId}/agents/${agentId}/prompt-forge`)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Back to sessions</TooltipContent>
            </Tooltip>
            <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <FlaskConical className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground shrink-0">Prompt Forge</span>
            {agentName && <><ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-700 shrink-0" /><span className="text-sm text-gray-400 dark:text-gray-500 shrink-0 hidden sm:block truncate max-w-[120px]">{agentName}</span></>}
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-700 shrink-0" />
            {readOnly
              ? <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{sessionName}</span>
              : <SessionNameEditor name={sessionName} onSave={handleNameSave} />}
            {viewingVersion && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium rounded-full shrink-0">v{viewingVersion.version}</Badge>}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium rounded-full shrink-0">Beta</Badge>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {backendDown && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/10 text-warning text-xs mr-1 cursor-default">
                    <WifiOff className="w-3 h-3" /><span>Backend offline</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Agent config server is unreachable.</TooltipContent>
              </Tooltip>
            )}
            {!readOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2" onClick={() => setConfigImportOpen(true)}>
                    <Code2 className="w-3 h-3" /><span>Load config</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Paste agent config JSON to fill in the prompt, variables, tools, model &amp; greeting</TooltipContent>
              </Tooltip>
            )}
            {tools.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2" onClick={() => setToolsOpen(true)}>
                    <Zap className="w-3 h-3" /><span>{tools.length} tools</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View &amp; edit tools (incl. mock responses)</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2" onClick={() => setImportOpen(true)} disabled={isStreaming}>
                  <Download className="w-3 h-3" /><span>Import log</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import a past call log to replay</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2"
                  onClick={startConversation} disabled={!conversationStarted || isStreaming}>
                  <RotateCcw className="w-3 h-3" /><span>Restart</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Start the conversation again (with the greeting)</TooltipContent>
            </Tooltip>

            {/* Saved versions: each Save is one; open any read-only. */}
            <VersionsMenu versions={versions} viewingVersion={viewingVersion?.version ?? null} onOpen={openVersion} />
            <ShareButton copied={linkCopied} version={viewingVersion?.version ?? null} onShare={shareLink} />

            <HeaderAction
              viewingVersion={!!viewingVersion} canEdit={canEdit} readOnly={readOnly}
              onRestore={handleRestore} onOpenDraft={openDraft} onDuplicate={handleDuplicate}
              draftState={draftState} onDraftRetry={() => setDraftRetry(n => n + 1)}
              saveState={saveState} latestVersion={versions[0]?.version} onSave={handleSave}
            />
          </div>
        </header>

        {/* Read-only: a saved version, or someone else's session */}
        {readOnly && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20 text-xs text-warning">
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 min-w-0 truncate">
              <ReadOnlyNotice viewingVersion={viewingVersion} canEdit={canEdit} ownerEmail={ownerEmail} />
            </span>
            {viewingVersion && !canEdit && (
              <button className="underline-offset-2 hover:underline" onClick={openDraft}>See the latest draft</button>
            )}
          </div>
        )}
        {saveError && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive">
            <span className="flex-1">{saveError}</span>
            <button onClick={() => setSaveError(null)}><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* ── Content ── */}
        <div ref={splitRef} className="flex flex-1 overflow-hidden">

            {/* Left: Prompt editor + variables */}
            <div className="flex flex-col min-w-0" style={{ width: `${leftPct}%` }}>
              <div className="h-9 shrink-0 flex items-center justify-between px-4 border-b border-border bg-card">
                <span className="text-xs font-medium text-muted-foreground">System prompt</span>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 h-6 px-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Settings2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] font-mono">{modelLabel}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Model settings</TooltipContent>
                  </Tooltip>
                  <button onClick={handleCopy} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-muted">
                    {copied ? <><Check className="w-3 h-3 text-success" /><span className="text-success">Copied</span></> : <><Copy className="w-3 h-3" />Copy</>}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <VariableTextarea
                  value={systemPrompt}
                  onChange={setSystemPrompt}
                  placeholder={promptPlaceholder(agentConfigLoading, backendDown)}
                  disabled={readOnly}
                  className="h-full border-0 rounded-none"
                  style={{ height: '100%', minHeight: '100%' }}
                />
              </div>
              <VariablePanel variables={shownVariables} onChange={setVariables} disabled={readOnly} autoFilled={autoFilledVariables} />
              <GreetingPanel greeting={greeting} onChange={setGreeting} disabled={readOnly} />
              <div className="h-7 shrink-0 flex items-center justify-between px-4 border-t border-border bg-card">
                <span className="text-[11px] text-muted-foreground tabular-nums">{systemPrompt.length.toLocaleString()} chars</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">{systemPrompt.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
              </div>
            </div>

            {/* Drag to resize the prompt / chat split (within limits); double-click resets. */}
            {/* A pointer-only handle, kept out of the tab order as before. */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Resize prompt and chat"
              title="Drag to resize · double-click to reset"
              onPointerDown={startResize}
              onDoubleClick={() => setLeftPct(DEFAULT_LEFT_PCT)}
              className="group relative w-px shrink-0 cursor-col-resize bg-muted"
            >
              <span className="absolute inset-y-0 -left-1.5 -right-1.5 group-hover:bg-blue-400/20 group-active:bg-blue-400/30" />
            </button>

            {/* Right: Chat */}
            <div className="flex-1 flex flex-col overflow-hidden bg-card">
              {importedFrom && <ImportedBanner meta={importedFrom} onClose={() => setImportedFrom(null)} />}
              <div className="flex-1 overflow-y-auto">
                {messages.length === 0
                  ? <ChatEmptyState hasTools={tools.length > 0} hasVariables={variables.length > 0}
                      onGenerateGreeting={greeting.mode === 'assistant_speaks_with_generated' && !isStreaming ? startConversation : undefined} />
                  : (
                    <div className="px-6 py-5 space-y-5 max-w-3xl mx-auto w-full">
                      {messages.map((m, i) => (
                        <MessageBubble key={m.id} message={m} onReplay={isStreaming ? undefined : () => handleReplay(i)} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )
                }
              </div>
              <MessageComposer
                inputRef={inputRef} value={input} onChange={setInput} onSend={handleSend} busy={isStreaming}
                blockedReason={providerBlocked ? (availability?.[provider]?.reason ?? 'This model can’t run here.') : null}
              />
            </div>
          </div>

        {/* Dialogs */}
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} provider={provider} onProviderChange={setProvider} model={model} onModelChange={setModel} temperature={temperature} onTemperatureChange={setTemperature} availability={availability} readOnly={readOnly} />
        <ConfigImportDialog open={configImportOpen} onClose={() => setConfigImportOpen(false)} onApply={handleConfigApply} />
        <ImportLogDialog open={importOpen} onClose={() => setImportOpen(false)} agentId={agentId} onImport={handleImport} transcriptionFields={extractorFields} />
        <ToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} tools={tools} onChange={setTools} readOnly={readOnly} agentTools={agentDefaults?.tools ?? null} />
      </div>
    </TooltipProvider>
  )
}

const PI_FORGE_SUGGESTIONS = [
  'Why did the agent answer like that?',
  'What’s missing or contradictory in this prompt?',
  'How do I make it ask for the date before booking?',
  'Summarise how this test conversation went',
].map(q => ({ label: q, prompt: q }))

// ─── Chat sub-components ──────────────────────────────────────────────────────

function emptyChatHint(hasTools?: boolean, hasVariables?: boolean): string {
  if (hasTools && hasVariables) return 'Variables will be substituted and tools are active. Send a message to test.'
  if (hasTools) return 'Tools are active and will be called live. Send a message to test.'
  if (hasVariables) return 'Variables will be substituted before sending. Send a message to test.'
  return 'Edit the system prompt, send a message to test, or import a past call log.'
}

function ChatEmptyState({ hasTools, hasVariables, onGenerateGreeting }: Readonly<{ hasTools?: boolean; hasVariables?: boolean; onGenerateGreeting?: () => void }>) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 select-none px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center">
        <FlaskConical className="w-5 h-5 text-gray-300 dark:text-gray-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">Start the conversation</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[300px] leading-relaxed">
          {emptyChatHint(hasTools, hasVariables)}
        </p>
      </div>
      {onGenerateGreeting && (
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={onGenerateGreeting}>
          <MessageSquareText className="w-3.5 h-3.5" />Start — the agent greets first
        </Button>
      )}
      {(hasTools || hasVariables) && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {hasVariables && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />Variables active</span>}
          {hasTools && <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5 text-amber-400" />Tools active</span>}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message, onReplay }: { message: Message; onReplay?: () => void }) {
  const isUser = message.role === 'user'
  const isThinking = !message.isFinal && message.content === '' && (message.toolCalls ?? []).length === 0

  if (isThinking) {
    return (
      <div className="flex gap-3 items-center py-1">
        <div className="relative w-6 h-6 shrink-0">
          <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Bot className="w-3 h-3 text-primary" />
          </div>
          <span className="absolute inset-[-3px] rounded-full border border-blue-400/40 dark:border-blue-500/30 animate-ping" />
        </div>
        <div className="flex items-end gap-1.5 pb-0.5">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const hasTools = (message.toolCalls?.length ?? 0) > 0
  // Replies that called tools show text and calls in the order they happened.
  const ordered = !isUser && hasTools && (message.parts?.length ?? 0) > 0
  const textBubble = (text: string, key?: string, streaming?: boolean) => (
    <div key={key} className={cn('rounded-2xl px-4 py-2.5 text-sm leading-relaxed w-full',
      isUser ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-tr-sm' : 'bg-muted/50 text-foreground border border-border rounded-tl-sm')}>
      <p className="whitespace-pre-wrap break-words">
        {text}
        {streaming && <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 align-middle animate-pulse" />}
      </p>
    </div>
  )
  return (
    <div className={cn('group flex gap-2 items-start', isUser && 'flex-row-reverse')}>
      <div className={cn('w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold mt-1',
        isUser ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-primary/15 text-primary border border-primary/30')}>
        {isUser ? 'U' : <Bot className="w-3 h-3" />}
      </div>
      <div className={cn('flex flex-col min-w-0', isUser ? 'items-end' : 'items-start')} style={{ maxWidth: '80%' }}>
        {ordered && (
          <div className="w-full space-y-1.5">
            {message.parts!.map((part, i) => {
              if (part.type === 'text') {
                const last = i === message.parts!.length - 1
                return part.text.trim() ? textBubble(part.text, `t${i}`, last && !message.isFinal) : null
              }
              const tc = message.toolCalls!.find(t => t.id === part.id)
              return tc ? <ToolCallBlock key={`c${part.id}`} tc={tc} /> : null
            })}
          </div>
        )}
        {!ordered && (message.content || !hasTools) && (
          <div className={cn('rounded-2xl px-4 py-2.5 text-sm leading-relaxed w-full',
            isUser ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-tr-sm' : 'bg-muted/50 text-foreground border border-border rounded-tl-sm')}>
            <p className="whitespace-pre-wrap break-words">
              {message.content}
              {!message.isFinal && message.content && <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 align-middle animate-pulse" />}
            </p>
          </div>
        )}
        {!ordered && hasTools && <div className="w-full space-y-0">{message.toolCalls!.map((tc, i) => <ToolCallBlock key={tc.id ?? i} tc={tc} />)}</div>}
      </div>
      {message.isFinal && onReplay && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onReplay} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 dark:text-gray-700 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 mt-1">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Replay from here</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-card">
      <div className="h-11 border-b border-border px-4 flex items-center gap-3">
        <Skeleton className="h-6 w-6 rounded-md" /><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-36" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col border-r border-border" style={{ width: '42%' }}>
          <div className="h-9 border-b border-border px-4 flex items-center"><Skeleton className="h-3.5 w-24" /></div>
          <div className="flex-1 p-5"><Skeleton className="h-full w-full rounded-lg" /></div>
          <div className="h-7 border-t border-border px-4 flex items-center gap-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-12 ml-auto" /></div>
        </div>
        <div className="flex-1 p-6 flex flex-col items-center justify-center gap-3">
          <Skeleton className="h-12 w-12 rounded-2xl" /><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-52" />
        </div>
      </div>
    </div>
  )
}

export default function PromptForgeSessionRoute() {
  return <Suspense fallback={null}><SessionDetailGuard /></Suspense>
}
