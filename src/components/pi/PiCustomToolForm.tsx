'use client'

import { useState } from 'react'

type Param = { name: string; type: string; description: string; required: boolean }
type ParamRow = Param & { id: number } // id is only a stable React key, never sent to the server

let paramSeq = 0
const withId = (p: Param): ParamRow => ({ ...p, id: ++paramSeq })

export type ToolDraft = {
  type?: string
  name?: string
  description?: string
  api_url?: string
  http_method?: string
  timeout?: number
  async?: boolean
  headers?: Record<string, string>
  parameters?: Param[]
  custom_payload?: string
}

const TYPES = [
  { id: 'custom_function', label: 'Custom HTTP' },
  { id: 'end_call', label: 'End call' },
  { id: 'knowledge_search', label: 'Knowledge search' },
  { id: 'voicemail_detection', label: 'Voicemail detection' },
  { id: 'update_vad_options', label: 'Update VAD' },
]

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const field = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'

function addedKey(toolCallId: string) {
  return `pi-tool-added:${toolCallId}`
}

export default function PiCustomToolForm({
  projectId,
  agentId,
  label,
  draft,
  toolCallId,
}: Readonly<{ projectId: string; agentId: string; label: string; draft: ToolDraft; toolCallId: string }>) {
  const [type, setType] = useState(draft.type || 'custom_function')
  const [name, setName] = useState(draft.name || '')
  const [description, setDescription] = useState(draft.description || '')
  const [apiUrl, setApiUrl] = useState(draft.api_url || '')
  const [method, setMethod] = useState(draft.http_method || 'POST')
  const [timeoutSec, setTimeoutSec] = useState(String(draft.timeout ?? 10))
  const [asyncExec, setAsyncExec] = useState(draft.async !== false)
  const [headers, setHeaders] = useState(JSON.stringify(draft.headers && Object.keys(draft.headers).length ? draft.headers : { 'Content-Type': 'application/json' }, null, 2))
  const [payload, setPayload] = useState(draft.custom_payload || '')
  const [params, setParams] = useState<ParamRow[]>(() => (draft.parameters?.length ? draft.parameters : [{ name: '', type: 'str', description: '', required: true }]).map(withId))
  const updateParam = (id: number, patch: Partial<Param>) => setParams((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(() => {
    try { return sessionStorage.getItem(addedKey(toolCallId)) ? 'saved' : 'idle' } catch { return 'idle' }
  })
  const [savedName, setSavedName] = useState(() => {
    try { return sessionStorage.getItem(addedKey(toolCallId)) || '' } catch { return '' }
  })
  const [error, setError] = useState('')
  const custom = type === 'custom_function'

  const fail = (message: string) => {
    setStatus('error')
    setError(message)
  }

  // First problem with the form, or null; parsed headers come back with it so they are only parsed once.
  const checkForm = (): { error: string } | { headers: Record<string, string> } => {
    if (!name.trim()) return { error: 'Give the tool a name.' }
    if (!custom) return { headers: {} }
    if (!/^https?:\/\/\S+$/i.test(apiUrl.trim())) return { error: 'API URL must start with http:// or https://' }
    const seconds = Number(timeoutSec)
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 120) return { error: 'Timeout must be between 1 and 120 seconds.' }
    if (!headers.trim()) return { headers: {} }
    const hint = 'Headers must be a JSON object, like {"Authorization":"Bearer TOKEN"}'
    let parsed: unknown
    try {
      parsed = JSON.parse(headers)
    } catch {
      return { error: hint }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: hint }
    return { headers: parsed as Record<string, string> }
  }

  // Not retried automatically: adding a tool is not idempotent, so a lost response could double-add it.
  // A failure re-enables the button and says what happened so the user can retry on purpose.
  const submit = async () => {
    if (status === 'saving') return
    setError('')
    const checked = checkForm()
    if ('error' in checked) return fail(checked.error)
    const parsedHeaders = checked.headers
    setStatus('saving')
    try {
      const res = await fetch('/api/pi/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          agentId,
          tool: {
            type,
            name: name.trim(),
            description,
            api_url: apiUrl.trim(),
            http_method: method,
            timeout: Number(timeoutSec) || 10,
            async: asyncExec,
            headers: parsedHeaders,
            parameters: params.filter((p) => p.name.trim()).map(({ id: _id, ...rest }) => rest),
            custom_payload: payload,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return fail(data.error || 'Could not add the tool')
      try { sessionStorage.setItem(addedKey(toolCallId), name.trim() || 'Tool') } catch {}
      setSavedName(name.trim() || 'Tool')
      setStatus('saved')
    } catch {
      fail('Could not reach the server. The tool may not have been added — check the agent before trying again.')
    }
  }

  if (status === 'saved') {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
        {savedName || 'Tool'} added to {label}.
      </div>
    )
  }

  return (
    <div className="mt-3 min-w-0 max-w-full space-y-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">Add a tool to {label}</p>
      <label className="block text-[12px] text-gray-500">
        <span>Type</span>
        <select className={`${field} mt-1`} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label className="block text-[12px] text-gray-500">
        <span>Name</span>
        <input className={`${field} mt-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="book_slot" />
      </label>
      <label className="block text-[12px] text-gray-500">
        <span>Description</span>
        <input className={`${field} mt-1`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the tool does" />
      </label>
      {custom && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[12px] text-gray-500">
              <span>Method</span>
              <select className={`${field} mt-1`} value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="block text-[12px] text-gray-500">
              <span>Timeout (seconds)</span>
              <input className={`${field} mt-1`} type="number" min={1} max={120} value={timeoutSec} onChange={(e) => setTimeoutSec(e.target.value)} />
            </label>
          </div>
          <label className="block text-[12px] text-gray-500">
            <span>API URL</span>
            <input className={`${field} mt-1`} value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://api.example.com/book" />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={asyncExec} onChange={(e) => setAsyncExec(e.target.checked)} />
            <span>Run async</span>
          </label>
          <div className="space-y-1">
            <p className="text-[12px] text-gray-500">Parameters</p>
            {params.map((p) => (
              <div key={p.id} className="min-w-0 space-y-1 rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                <input className={field} placeholder="name" value={p.name} onChange={(e) => updateParam(p.id, { name: e.target.value })} />
                <div className="flex min-w-0 items-center gap-2">
                  <select className={`${field} max-w-[8rem]`} value={p.type || 'str'} onChange={(e) => updateParam(p.id, { type: e.target.value })}>
                    {['str', 'int', 'float', 'bool'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-[11px] text-gray-500">
                    <input type="checkbox" checked={p.required} onChange={(e) => updateParam(p.id, { required: e.target.checked })} />
                    <span>required</span>
                  </label>
                </div>
                <input className={field} placeholder="description" value={p.description} onChange={(e) => updateParam(p.id, { description: e.target.value })} />
              </div>
            ))}
            <button type="button" className="text-[12px] text-blue-600 dark:text-blue-400" onClick={() => setParams((rows) => [...rows, withId({ name: '', type: 'str', description: '', required: false })])}>
              Add parameter
            </button>
          </div>
          <label className="block text-[12px] text-gray-500">
            <span>Body template</span>
            <textarea className={`${field} mt-1 font-mono`} rows={3} value={payload} onChange={(e) => setPayload(e.target.value)} placeholder='{"when":"__date__","at":"__timestamp__"}' />
          </label>
          <label className="block text-[12px] text-gray-500">
            <span>Headers (JSON)</span>
            <textarea className={`${field} mt-1 font-mono`} rows={3} value={headers} onChange={(e) => setHeaders(e.target.value)} />
          </label>
        </>
      )}
      <button type="button" disabled={status === 'saving'} onClick={() => void submit()} className="rounded-lg bg-gray-900 px-3 py-1.5 text-[13px] text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900">
        {status === 'saving' ? 'Adding…' : 'Add tool'}
      </button>
      {error && <p role="alert" className="text-[12px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
