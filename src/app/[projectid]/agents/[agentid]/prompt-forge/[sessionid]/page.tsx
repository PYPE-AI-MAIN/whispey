'use client'

import { useParams, useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlaskConical, Lock, Mic, Send, Copy, Check, RotateCcw, Download,
  Bot, WifiOff, Settings2, Thermometer, ChevronLeft, ChevronRight, CornerDownLeft,
  Zap, ChevronDown, Phone, X, Loader2, Clock, Code2, Save,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { useAgentConfig } from '@/hooks/useAgentConfig'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { VariableTextarea } from '@/components/agents/variables/VariableTextarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENAI_MODELS = [
  { value: 'gpt-4o',        label: 'GPT-4o' },
  { value: 'gpt-4o-mini',   label: 'GPT-4o mini' },
  { value: 'gpt-4-turbo',   label: 'GPT-4 Turbo' },
  { value: 'gpt-4',         label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'o1',            label: 'o1' },
  { value: 'o1-mini',       label: 'o1-mini' },
  { value: 'o3-mini',       label: 'o3-mini' },
]

const AZURE_MODEL = { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' }

type Provider = 'openai' | 'azure_openai'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variable { name: string; value: string; description: string }
interface ToolParam { name: string; type: string; description: string; required: boolean }
interface AgentTool {
  id: string; type: string; name: string; description: string
  endpoint?: string; method?: string; headers?: Record<string, string>; body?: string
  parameters: ToolParam[]
}
interface ParsedConfig {
  llm: { provider: Provider; model: string; temperature: number }
  prompt: string; variables: Variable[]; tools: AgentTool[]; firstMessage?: string
}
interface ToolCall {
  id?: string; name: string; arguments?: any; result?: any
  success?: boolean; duration_ms?: number; pending?: boolean
}
interface Message {
  id: string; role: 'user' | 'assistant'; content: string
  isFinal: boolean; toolCalls?: ToolCall[]; fromCallLog?: boolean
}
interface ImportedMeta { phone: string; date: string; duration: string }

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

function substituteVariables(text: string, variables: Variable[]): string {
  return variables.reduce((t, v) => {
    if (!v.value) return t
    return t.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), v.value)
  }, text)
}

function parseAgentConfig(json: string): ParsedConfig | null {
  try {
    const raw = JSON.parse(json)
    const c = raw.config ?? raw
    const llm = c.llm ?? {}
    const prompt = c.prompt ?? {}
    const toolsDef = c.advancedSettings?.tools?.tools ?? []
    return {
      llm: { provider: llm.provider === 'azure_openai' ? 'azure_openai' : 'openai', model: llm.model ?? '', temperature: llm.temperature ?? 0.7 },
      prompt: prompt.text ?? '',
      variables: (prompt.variables ?? []).map((v: any) => ({ name: v.name ?? '', value: v.value ?? '', description: v.description ?? '' })),
      tools: toolsDef.map((t: any) => ({
        id: t.id ?? crypto.randomUUID(), type: t.type ?? 'custom_function', name: t.name ?? '',
        description: t.config?.description ?? '', endpoint: t.config?.endpoint ?? '',
        method: t.config?.method ?? 'POST', headers: t.config?.headers ?? {}, body: t.config?.body ?? '',
        parameters: (t.config?.parameters ?? []).map((p: any) => ({ name: p.name ?? '', type: p.type ?? 'string', description: p.description ?? '', required: p.required ?? false })),
      })),
      firstMessage: c.conversationFlow?.customFirstMessage ?? c.conversationFlow?.firstMessageMode?.first_message ?? '',
    }
  } catch { return null }
}

function turnsToMessages(turns: any[]): Message[] {
  const msgs: Message[] = []
  for (const turn of turns) {
    const userText = (turn.user_transcript ?? '').replace(/<(?:eod)\s*\/>/gi, '').trim()
    const agentText = (turn.agent_response ?? '').replace(/<(?:eod)\s*\/>/gi, '').trim()
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

async function fetchCallLogPage(agentId: string, page: number) {
  const r = await fetch(`/api/agents/${agentId}/call-logs/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_agent_id: agentId, p_pre_distinct_filters: [], p_post_distinct_filters: [],
      p_select: 'id,call_id,customer_number,created_at,duration_seconds,call_ended_reason,wcall_event',
      p_order_by_column: 'created_at', p_order_ascending: false,
      p_limit: IMPORT_PAGE_SIZE + 1, p_offset: (page - 1) * IMPORT_PAGE_SIZE,
      p_distinct_column: null, p_distinct_json_field: null, p_distinct_order: 'desc',
      p_date_from: null, p_date_to: null, p_user_clerk_id: null, p_user_email: null,
    }),
  })
  const { data, error } = await r.json()
  if (error) throw new Error(String(error))
  const filtered = (data ?? []).filter((c: any) => c.wcall_event !== 'call_started')
  return { items: filtered.slice(0, IMPORT_PAGE_SIZE), hasNext: filtered.length > IMPORT_PAGE_SIZE }
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
  const toolsDef = assistant?.advancedSettings?.tools?.tools ?? []
  return toolsDef.map((t: any) => ({
    id: t.id ?? crypto.randomUUID(), type: t.type ?? 'custom_function', name: t.name ?? '',
    description: t.config?.description ?? '', endpoint: t.config?.endpoint ?? '',
    method: t.config?.method ?? 'POST', headers: t.config?.headers ?? {}, body: t.config?.body ?? '',
    parameters: (t.config?.parameters ?? []).map((p: any) => ({ name: p.name ?? '', type: p.type ?? 'string', description: p.description ?? '', required: p.required ?? false })),
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

  if (isLoading) return <PageSkeleton />
  if (!canAccessPromptForge) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-10 max-w-sm w-full text-center shadow-sm mx-4">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Restricted</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
            Prompt Forge requires{' '}
            <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono text-gray-700 dark:text-gray-300">promptforge: true</code>{' '}
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
  const [session, setSession] = useState<any | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const { data: agentRows, isLoading: agentLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, configuration',
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
    return `${agentRow.name}_${agentId.replace(/-/g, '_')}`
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
    fetch(`/api/prompt-forge/sessions/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) setNotFound(true)
        else setSession(data)
        setSessionLoading(false)
      })
      .catch(() => { setNotFound(true); setSessionLoading(false) })
  }, [sessionId])

  const isConfigLoading = isPipecat
    ? (!!pipecatAgentId && pipecatConfigLoading)
    : (!!agentNameWithId && configLoading)

  if (sessionLoading || agentLoading || isConfigLoading) return <PageSkeleton />

  if (notFound) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Session not found.</p>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => router.replace(`/${projectId}/agents/${agentId}/prompt-forge`)}>
            Back to sessions
          </Button>
        </div>
      </div>
    )
  }

  let initialPrompt = session.system_prompt || ''
  let initialModel = session.model || 'gpt-4o-mini'
  let initialProvider: Provider = (session.provider as Provider) || 'openai'
  let initialTemperature: number = session.temperature ?? 0.7
  let agentTools: AgentTool[] = session.tools?.length > 0 ? session.tools : []
  let backendDown = false

  if (isPipecat && pipecatAgent) {
    initialPrompt = initialPrompt || pipecatAgent.prompt || ''
    initialModel = session.model || pipecatAgent.llm_model || 'gpt-4o-mini'
    initialProvider = (session.provider as Provider) || (pipecatAgent.llm_provider === 'azure_openai' ? 'azure_openai' : 'openai')
    initialTemperature = session.temperature ?? 0.7
    if (!session.tools?.length) {
      agentTools = (pipecatAgent.custom_tools ?? []).map((t: any) => {
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
            name,
            type: schema.type ?? 'string',
            description: schema.description ?? '',
            required: required.includes(name),
          })),
        }
      })
    }
  } else {
    const assistant = agentConfig?.agent?.assistant?.[0]
    initialPrompt = initialPrompt || assistant?.prompt || ''
    initialModel = session.model || assistant?.llm?.model || 'gpt-4o-mini'
    initialProvider = (session.provider as Provider) || (assistant?.llm?.provider === 'azure_openai' ? 'azure_openai' : 'openai')
    initialTemperature = session.temperature ?? assistant?.llm?.temperature ?? 0.7
    if (!session.tools?.length) agentTools = extractToolsFromAssistant(assistant)
    backendDown = agentConfig?.backendUnavailable ?? false
  }

  return (
    <ForgeUI
      projectId={projectId}
      agentId={agentId}
      agentName={agentRow?.name ?? ''}
      sessionId={sessionId}
      sessionName={session.name || 'Untitled session'}
      initialPrompt={initialPrompt}
      initialModel={initialModel}
      initialProvider={initialProvider}
      initialTemperature={initialTemperature}
      initialVariables={session.variables ?? []}
      initialTools={agentTools}
      initialMessages={(session.messages ?? []).map((m: any) => ({ ...m, isFinal: true }))}
      backendDown={backendDown}
    />
  )
}

// ─── Settings dialog ──────────────────────────────────────────────────────────

function SettingsDialog({ open, onClose, provider, onProviderChange, model, onModelChange, temperature, onTemperatureChange }: {
  open: boolean; onClose: () => void
  provider: Provider; onProviderChange: (v: Provider) => void
  model: string; onModelChange: (v: string) => void
  temperature: number; onTemperatureChange: (v: number) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Model Settings</DialogTitle>
          <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">Overrides apply only to this session.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 pt-1">
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Provider</Label>
            <Select value={provider} onValueChange={v => { onProviderChange(v as Provider); onModelChange(v === 'azure_openai' ? AZURE_MODEL.value : 'gpt-4o-mini') }}>
              <SelectTrigger className="h-9 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                <SelectItem value="openai" className="text-sm text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-800">OpenAI</SelectItem>
                <SelectItem value="azure_openai" className="text-sm text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-800">Azure OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{provider === 'azure_openai' ? 'Deployment' : 'Model'}</Label>
            {provider === 'azure_openai' ? (
              <div className="h-9 flex items-center px-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100">{AZURE_MODEL.label}</div>
            ) : (
              <Select value={model} onValueChange={onModelChange}>
                <SelectTrigger className="h-9 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                  {OPENAI_MODELS.map(m => <SelectItem key={m.value} value={m.value} className="text-sm text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-800">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {provider === 'azure_openai' && <p className="text-[11px] text-gray-400 dark:text-gray-600">Endpoint and API version read from server env.</p>}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />Temperature
              </Label>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300 tabular-nums w-8 text-right">{temperature.toFixed(1)}</span>
            </div>
            <Slider value={[temperature]} onValueChange={([v]) => onTemperatureChange(v)} min={0} max={2} step={0.1} className="w-full" />
            <div className="flex justify-between">
              <span className="text-[11px] text-gray-400 dark:text-gray-500">0 — Precise</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">2 — Creative</span>
            </div>
          </div>
        </div>
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
      <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Load Agent Config</DialogTitle>
          <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
            Paste your agent config JSON to auto-populate the prompt, variables, and tools.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={json}
          onChange={e => { setJson(e.target.value); setParsed(null); setError(null) }}
          placeholder={'{\n  "version": "1.0",\n  "config": { ... }\n}'}
          rows={10}
          className="w-full text-xs font-mono rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 resize-none outline-none focus:border-gray-300 dark:focus:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-600 leading-relaxed"
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2">{error}</p>}
        {parsed && (
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg px-4 py-3 text-xs space-y-1">
            <p className="font-semibold text-green-700 dark:text-green-400 mb-1.5">Config parsed — ready to apply</p>
            <p className="text-green-600 dark:text-green-500">✓ Prompt: {parsed.prompt.length.toLocaleString()} chars</p>
            <p className="text-green-600 dark:text-green-500">✓ Variables: {parsed.variables.length} ({parsed.variables.map(v => v.name).join(', ')})</p>
            <p className="text-green-600 dark:text-green-500">✓ Tools: {parsed.tools.length} ({parsed.tools.map(t => t.name).join(', ')})</p>
            {parsed.firstMessage && <p className="text-green-600 dark:text-green-500">✓ First message detected</p>}
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

function ImportLogDialog({ open, onClose, agentId, onImport }: {
  open: boolean; onClose: () => void; agentId: string
  onImport: (messages: Message[], meta: ImportedMeta) => void
}) {
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
      const { items, hasNext } = await fetchCallLogPage(agentId, p)
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
  }, [open, agentId])

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
      <DialogContent className="sm:max-w-3xl p-0 gap-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col" style={{ height: '75vh', maxHeight: 640 }}>
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <DialogTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import Call Log</DialogTitle>
          <DialogDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Select a call to preview, then import it to replay with a different prompt.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {loading && <div className="flex items-center justify-center py-12 gap-2 text-xs text-gray-400 dark:text-gray-600"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>}
              {!loading && error && <div className="px-4 py-3 text-xs text-red-600 dark:text-red-400">{error}</div>}
              {!loading && !error && logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 px-4 text-center">
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><Phone className="w-4 h-4 text-gray-400 dark:text-gray-600" /></div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">No completed calls found</p>
                </div>
              )}
              {!loading && logs.map(log => (
                <button key={log.id} onClick={() => handleSelectLog(log)}
                  className={cn('w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors',
                    selectedId === log.id ? 'bg-violet-50 dark:bg-violet-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800')}
                >
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
                    selectedId === log.id ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-200 dark:border-violet-800' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700')}>
                    <Phone className={cn('w-3 h-3', selectedId === log.id ? 'text-violet-500 dark:text-violet-400' : 'text-gray-400 dark:text-gray-500')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-medium truncate', selectedId === log.id ? 'text-violet-700 dark:text-violet-300' : 'text-gray-900 dark:text-gray-100')}>
                      {log.customer_number || 'Unknown caller'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-gray-400 dark:text-gray-600">{formatRelative(log.created_at)}</span>
                      {log.duration_seconds > 0 && <><span className="text-gray-300 dark:text-gray-700">·</span><span className="text-[10px] text-gray-400 dark:text-gray-600">{formatDuration(log.duration_seconds)}</span></>}
                      {log.call_ended_reason && <><span className="text-gray-300 dark:text-gray-700">·</span><span className="text-[10px] text-gray-400 dark:text-gray-600 capitalize">{log.call_ended_reason.replace(/_/g, ' ')}</span></>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {showPagination && (
              <div className="shrink-0 flex items-center justify-center gap-0.5 py-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 dark:text-gray-400" disabled={page === 1 || loading} onClick={() => goToPage(page - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {pageItems.map((item, idx) =>
                  item === '…'
                    ? <span key={`e${idx}`} className="w-6 text-center text-xs text-gray-400 dark:text-gray-600 select-none">…</span>
                    : <Button key={item} variant={item === page ? 'default' : 'ghost'} size="sm" className={cn('h-7 w-7 p-0 text-xs font-medium', item === page && 'pointer-events-none')} disabled={loading} onClick={() => goToPage(item as number)}>{item}</Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 dark:text-gray-400" disabled={!hasNextPage || loading} onClick={() => goToPage(page + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><Phone className="w-4 h-4 text-gray-300 dark:text-gray-600" /></div>
                <p className="text-xs text-gray-400 dark:text-gray-600">Select a call to preview</p>
              </div>
            ) : previewLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-xs text-gray-400 dark:text-gray-600"><Loader2 className="w-4 h-4 animate-spin" />Loading preview…</div>
            ) : previewTurns && previewTurns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center"><p className="text-xs text-gray-400 dark:text-gray-600">No transcript data for this call.</p></div>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {(previewTurns ?? []).map((turn: any, i: number) => {
                  const userText = (turn.user_transcript ?? '').replace(/<(?:eod)\s*\/>/gi, '').trim()
                  const agentText = (turn.agent_response ?? '').replace(/<(?:eod)\s*\/>/gi, '').trim()
                  return (
                    <div key={i} className="space-y-2">
                      {userText && <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-xs leading-relaxed">{userText}</div></div>}
                      {agentText && <div className="flex justify-start"><div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs leading-relaxed">{agentText}</div></div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="h-8 text-xs" onClick={handleImport} disabled={!canImport}>Import this call</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tools sheet ──────────────────────────────────────────────────────────────

const TOOL_TYPE_STYLES: Record<string, string> = {
  custom_function:  'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
  transfer_call:    'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/40',
  knowledge_search: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/40',
}

function ToolCard({ tool }: { tool: AgentTool }) {
  const [expanded, setExpanded] = useState(false)
  const typeStyle = TOOL_TYPE_STYLES[tool.type] ?? TOOL_TYPE_STYLES.custom_function
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors">
        <Zap className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
            <span className={cn('text-[10px] px-1.5 py-px rounded border font-medium shrink-0', typeStyle)}>{tool.type.replace(/_/g, ' ')}</span>
          </div>
          {tool.description && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{tool.description}</p>}
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          {tool.endpoint && (
            <div className="px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-1">Endpoint</p>
              <code className="text-[11px] text-gray-700 dark:text-gray-300 font-mono break-all leading-relaxed">{tool.method} {tool.endpoint}</code>
            </div>
          )}
          {tool.parameters.length > 0 && (
            <div className="px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2">Parameters</p>
              <div className="space-y-2">
                {tool.parameters.map(p => (
                  <div key={p.name} className="flex items-start gap-2">
                    <code className="text-[11px] font-mono text-violet-600 dark:text-violet-400 shrink-0 mt-0.5">{p.name}</code>
                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded mt-0.5 shrink-0">{p.type}</span>
                    {p.required && <span className="text-[10px] text-red-500 shrink-0 mt-0.5">required</span>}
                    {p.description && <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToolsSheet({ open, onClose, tools }: { open: boolean; onClose: () => void; tools: AgentTool[] }) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[480px] sm:max-w-[480px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />Tools ({tools.length})
          </SheetTitle>
          <SheetDescription className="text-xs text-gray-500 dark:text-gray-400">
            Custom functions with endpoints will be executed in Forge. Transfer and knowledge tools are mocked.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 mt-2">{tools.map(tool => <ToolCard key={tool.id} tool={tool} />)}</div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Tool call block ──────────────────────────────────────────────────────────

function ToolCallBlock({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  if (tc.pending) {
    return (
      <div className="mt-1.5 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 text-xs overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Loader2 className="w-3 h-3 text-amber-500 animate-spin shrink-0" />
          <span className="font-mono font-medium text-amber-700 dark:text-amber-400 flex-1 truncate">{tc.name}</span>
          <span className="text-[10px] text-amber-500 dark:text-amber-600">calling…</span>
        </div>
      </div>
    )
  }
  const ok = tc.success !== false
  return (
    <div className="mt-1.5 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs bg-white dark:bg-gray-900">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors">
        <Zap className="w-3 h-3 text-amber-500 shrink-0" />
        <span className="font-mono font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{tc.name}</span>
        {tc.duration_ms != null && <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{tc.duration_ms}ms</span>}
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', ok ? 'bg-green-500' : 'bg-red-500')} />
        <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform shrink-0', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          {tc.arguments != null && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-1.5">Arguments</p>
              <pre className="text-[11px] text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-auto">
                {typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments, null, 2)}
              </pre>
            </div>
          )}
          {tc.result != null && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-1.5">Result</p>
              <pre className="text-[11px] text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-auto">
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

function VariablePanel({ variables, onChange }: { variables: Variable[]; onChange: (v: Variable[]) => void }) {
  const [open, setOpen] = useState(true)
  if (variables.length === 0) return null
  return (
    <div className="shrink-0 border-t border-gray-200 dark:border-gray-800">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 h-8 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500 shrink-0" />
          Variables ({variables.length})
        </span>
        <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 max-h-52 overflow-y-auto space-y-1.5">
          {variables.map((v, i) => (
            <div key={v.name} className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[11px] font-mono text-violet-600 dark:text-violet-400 w-36 shrink-0 truncate cursor-default">{`{{${v.name}}}`}</span>
                </TooltipTrigger>
                {v.description && <TooltipContent side="left" className="text-xs max-w-[200px]">{v.description}</TooltipContent>}
              </Tooltip>
              <input
                value={v.value}
                onChange={e => { const updated = [...variables]; updated[i] = { ...v, value: e.target.value }; onChange(updated) }}
                placeholder={v.description || 'value…'}
                className="flex-1 h-6 text-xs px-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
              />
            </div>
          ))}
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
        className="text-sm font-medium bg-white dark:bg-gray-800 border border-violet-400 dark:border-violet-500 rounded px-2 py-0.5 text-gray-900 dark:text-gray-100 outline-none min-w-0 max-w-[200px]"
      />
    )
  }

  return (
    <button onClick={startEdit} className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-violet-600 dark:hover:text-violet-400 transition-colors truncate max-w-[200px]" title="Click to rename">
      {name || 'Untitled session'}
    </button>
  )
}

// ─── Main forge UI ────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved'

function ForgeUI({
  projectId, agentId, agentName, sessionId, sessionName: initialSessionName,
  initialPrompt, initialModel, initialProvider, initialTemperature,
  initialVariables, initialTools, initialMessages, backendDown,
}: {
  projectId: string; agentId: string; agentName: string
  sessionId: string; sessionName: string
  initialPrompt: string; initialModel: string; initialProvider: Provider
  initialTemperature: number; initialVariables: Variable[]; initialTools: AgentTool[]
  initialMessages: Message[]; backendDown: boolean
}) {
  const router = useRouter()
  const [sessionName, setSessionName] = useState(initialSessionName)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [systemPrompt, setSystemPrompt] = useState(initialPrompt)
  const [provider, setProvider] = useState<Provider>(initialProvider)
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleConfigApply = useCallback((config: ParsedConfig) => {
    if (config.prompt) setSystemPrompt(config.prompt)
    setVariables(config.variables)
    setTools(config.tools)
  }, [])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(systemPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [systemPrompt])

  const handleImport = useCallback((msgs: Message[], meta: ImportedMeta) => {
    setMessages(msgs); setImportedFrom(meta)
  }, [])

  const handleSave = useCallback(async () => {
    if (saveState === 'saving') return
    setSaveState('saving')
    try {
      await fetch(`/api/prompt-forge/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: systemPrompt, variables, tools, messages, model, provider, temperature }),
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch { setSaveState('idle') }
  }, [saveState, sessionId, systemPrompt, variables, tools, messages, model, provider, temperature])

  const handleNameSave = useCallback(async (name: string) => {
    setSessionName(name)
    await fetch(`/api/prompt-forge/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }, [sessionId])

  const sendMessage = useCallback(async (userContent: string, historyBefore: Message[]) => {
    if (isStreaming) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userContent, isFinal: true }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', isFinal: false, toolCalls: [] }
    setMessages([...historyBefore, userMsg, assistantMsg])
    setImportedFrom(null)
    setIsStreaming(true)
    const historyForApi = [...historyBefore, userMsg].map(m => ({ role: m.role, content: m.content }))
    const effectivePrompt = substituteVariables(systemPrompt, variables)
    try {
      const res = await fetch('/api/prompt-forge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi, systemPrompt: effectivePrompt, model, temperature, provider, tools: tools.length > 0 ? tools : undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: err.error ?? 'Error', isFinal: true } : m))
        return
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') { setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isFinal: true } : m)); continue }
          try {
            const { text, error, toolCall, toolResult } = JSON.parse(payload)
            if (error) { setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: error, isFinal: true } : m)) }
            else if (text) { setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + text } : m)) }
            else if (toolCall) {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, toolCalls: [...(m.toolCalls ?? []), { id: toolCall.id, name: toolCall.name, arguments: toolCall.arguments, pending: true }] } : m))
            } else if (toolResult) {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, toolCalls: (m.toolCalls ?? []).map(tc => tc.id === toolResult.id ? { ...tc, result: toolResult.result, success: toolResult.success, duration_ms: toolResult.duration_ms, pending: false } : tc) } : m))
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: err?.message ?? 'Network error', isFinal: true } : m))
    } finally { setIsStreaming(false) }
  }, [isStreaming, systemPrompt, variables, model, temperature, provider, tools])

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

  const modelLabel = useMemo(() => {
    if (provider === 'azure_openai') return `Azure / ${AZURE_MODEL.label}`
    return OPENAI_MODELS.find(m => m.value === model)?.label ?? model
  }, [provider, model])

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">

        {/* ── Topbar ── */}
        <header className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => router.push(`/${projectId}/agents/${agentId}/prompt-forge`)} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Back to sessions</TooltipContent>
            </Tooltip>
            <div className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
              <FlaskConical className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0">Prompt Forge</span>
            {agentName && <><ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-700 shrink-0" /><span className="text-sm text-gray-400 dark:text-gray-500 shrink-0 hidden sm:block truncate max-w-[120px]">{agentName}</span></>}
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-700 shrink-0" />
            <SessionNameEditor name={sessionName} onSave={handleNameSave} />
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium rounded-full shrink-0">Beta</Badge>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {backendDown && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs mr-1 cursor-default">
                    <WifiOff className="w-3 h-3" /><span>Backend offline</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Agent config server is unreachable.</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 px-2" onClick={() => setConfigImportOpen(true)}>
                  <Code2 className="w-3 h-3" /><span>Load config</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Paste agent config JSON to populate prompt, variables &amp; tools</TooltipContent>
            </Tooltip>
            {tools.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 px-2" onClick={() => setToolsOpen(true)}>
                    <Zap className="w-3 h-3" /><span>{tools.length} tools</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View configured tools</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 px-2" onClick={() => setImportOpen(true)} disabled={isStreaming}>
                  <Download className="w-3 h-3" /><span>Import log</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import a past call log to replay</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 px-2"
                  onClick={() => { setMessages([]); setImportedFrom(null) }} disabled={messages.length === 0 || isStreaming}>
                  <RotateCcw className="w-3 h-3" /><span>Clear</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear conversation</TooltipContent>
            </Tooltip>

            {/* Save button */}
            <Button
              size="sm"
              className={cn(
                'h-7 gap-1.5 text-xs px-3 ml-1 transition-colors',
                saveState === 'saved'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300',
              )}
              onClick={handleSave}
              disabled={saveState === 'saving'}
            >
              {saveState === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
              {saveState === 'saved' && <Check className="w-3 h-3" />}
              {saveState === 'idle' && <Save className="w-3 h-3" />}
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save'}
            </Button>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="flex flex-1 overflow-hidden">

            {/* Left: Prompt editor + variables */}
            <div className="flex flex-col border-r border-gray-200 dark:border-gray-800" style={{ width: '42%', minWidth: 300, maxWidth: 600 }}>
              <div className="h-9 shrink-0 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">System prompt</span>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 h-6 px-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <Settings2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] font-mono">{modelLabel}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Model settings</TooltipContent>
                  </Tooltip>
                  <button onClick={handleCopy} className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors rounded px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800">
                    {copied ? <><Check className="w-3 h-3 text-green-500" /><span className="text-green-500">Copied</span></> : <><Copy className="w-3 h-3" />Copy</>}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <VariableTextarea
                  value={systemPrompt}
                  onChange={setSystemPrompt}
                  placeholder={backendDown ? 'Backend offline — paste your system prompt here…' : 'System prompt will auto-populate from your agent config…'}
                  className="h-full border-0 rounded-none"
                  style={{ height: '100%', minHeight: '100%' }}
                />
              </div>
              <VariablePanel variables={variables} onChange={setVariables} />
              <div className="h-7 shrink-0 flex items-center justify-between px-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <span className="text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">{systemPrompt.length.toLocaleString()} chars</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">{systemPrompt.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
              </div>
            </div>

            {/* Right: Chat */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
              {importedFrom && (
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800/30">
                  <Phone className="w-3 h-3 text-violet-500 dark:text-violet-400 shrink-0" />
                  <span className="text-xs text-violet-700 dark:text-violet-300 flex-1 min-w-0 truncate">
                    <span className="font-medium">{importedFrom.phone}</span>
                    <span className="text-violet-500 dark:text-violet-400 ml-1.5">· {importedFrom.date}{importedFrom.duration && ` · ${importedFrom.duration}`}</span>
                  </span>
                  <span className="text-[10px] text-violet-400 dark:text-violet-600 shrink-0">Imported · edit prompt &amp; replay</span>
                  <button onClick={() => setImportedFrom(null)} className="w-4 h-4 flex items-center justify-center rounded text-violet-400 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-800/30 transition-colors"><X className="w-3 h-3" /></button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {messages.length === 0
                  ? <ChatEmptyState hasTools={tools.length > 0} hasVariables={variables.length > 0} />
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
              <div className="shrink-0 px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 focus-within:border-gray-300 dark:focus-within:border-gray-600 focus-within:ring-1 focus-within:ring-gray-200 dark:focus-within:ring-gray-700 transition-all cursor-text" onClick={() => inputRef.current?.focus()}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder="Message…"
                    rows={1}
                    className="flex-1 resize-none bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none border-none leading-5 max-h-28 overflow-y-auto caret-gray-900 dark:caret-gray-100 py-0"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button disabled onClick={e => e.stopPropagation()} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 dark:text-gray-700 cursor-not-allowed">
                          <Mic className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Voice input — coming soon</TooltipContent>
                    </Tooltip>
                    <button
                      onClick={e => { e.stopPropagation(); handleSend() }}
                      disabled={!input.trim() || isStreaming}
                      className={cn('w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
                        input.trim() && !isStreaming ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed')}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 flex items-center gap-1"><CornerDownLeft className="w-2.5 h-2.5" />Enter to send · Shift+Enter for new line</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-600">Click any message to replay from that turn</span>
                </div>
              </div>
            </div>
          </div>

        {/* Dialogs */}
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} provider={provider} onProviderChange={setProvider} model={model} onModelChange={setModel} temperature={temperature} onTemperatureChange={setTemperature} />
        <ConfigImportDialog open={configImportOpen} onClose={() => setConfigImportOpen(false)} onApply={handleConfigApply} />
        <ImportLogDialog open={importOpen} onClose={() => setImportOpen(false)} agentId={agentId} onImport={handleImport} />
        <ToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} tools={tools} />
      </div>
    </TooltipProvider>
  )
}

// ─── Chat sub-components ──────────────────────────────────────────────────────

function ChatEmptyState({ hasTools, hasVariables }: { hasTools?: boolean; hasVariables?: boolean }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 select-none px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <FlaskConical className="w-5 h-5 text-gray-300 dark:text-gray-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Start the conversation</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 max-w-[300px] leading-relaxed">
          {hasTools && hasVariables ? 'Variables will be substituted and tools are active. Send a message to test.'
            : hasTools ? 'Tools are active and will be called live. Send a message to test.'
            : hasVariables ? 'Variables will be substituted before sending. Send a message to test.'
            : 'Edit the system prompt, send a message to test, or import a past call log.'}
        </p>
      </div>
      {(hasTools || hasVariables) && (
        <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-600">
          {hasVariables && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" />Variables active</span>}
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
          <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center">
            <Bot className="w-3 h-3 text-violet-500 dark:text-violet-400" />
          </div>
          <span className="absolute inset-[-3px] rounded-full border border-violet-400/40 dark:border-violet-500/30 animate-ping" />
        </div>
        <div className="flex items-end gap-1.5 pb-0.5">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const hasTools = (message.toolCalls?.length ?? 0) > 0
  return (
    <div className={cn('group flex gap-2 items-start', isUser && 'flex-row-reverse')}>
      <div className={cn('w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold mt-1',
        isUser ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/60')}>
        {isUser ? 'U' : <Bot className="w-3 h-3" />}
      </div>
      <div className={cn('flex flex-col min-w-0', isUser ? 'items-end' : 'items-start')} style={{ maxWidth: '80%' }}>
        {(message.content || !hasTools) && (
          <div className={cn('rounded-2xl px-4 py-2.5 text-sm leading-relaxed w-full',
            isUser ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-tr-sm' : 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm')}>
            <p className="whitespace-pre-wrap break-words">
              {message.content}
              {!message.isFinal && message.content && <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 align-middle animate-pulse" />}
            </p>
          </div>
        )}
        {hasTools && <div className="w-full space-y-0">{message.toolCalls!.map((tc, i) => <ToolCallBlock key={tc.id ?? i} tc={tc} />)}</div>}
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
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      <div className="h-11 border-b border-gray-200 dark:border-gray-800 px-4 flex items-center gap-3">
        <Skeleton className="h-6 w-6 rounded-md" /><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-36" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col border-r border-gray-200 dark:border-gray-800" style={{ width: '42%' }}>
          <div className="h-9 border-b border-gray-200 dark:border-gray-800 px-4 flex items-center"><Skeleton className="h-3.5 w-24" /></div>
          <div className="flex-1 p-5"><Skeleton className="h-full w-full rounded-lg" /></div>
          <div className="h-7 border-t border-gray-200 dark:border-gray-800 px-4 flex items-center gap-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-12 ml-auto" /></div>
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
