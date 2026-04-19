'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Phone,
  Plus,
  Trash2,
  Unlink,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'

interface PhoneNumber {
  number: string
  agent_id: string | null
  plivo_app_id: string | null
  call_types: string
  provider: string | null
  alias: string | null
  created_at: string
}

interface Agent {
  id: string
  name: string
}

interface PhoneNumbersPanelProps {
  /** The Supabase dashboard agent ID — used for fetching numbers */
  agentId: string
  /** The DynamoDB pipecat agent ID — used to pre-fill the assign form dropdown */
  pipecatAgentId?: string
  agentName?: string
}

const PROVIDERS   = ['acefone', 'plivo', 'other'] as const
const CALL_TYPES  = ['inbound', 'outbound', 'inbound,outbound'] as const
const CALL_LABELS: Record<string, string> = {
  'inbound':          'Inbound only',
  'outbound':         'Outbound only',
  'inbound,outbound': 'Inbound + Outbound',
}

const PROVIDER_COLORS: Record<string, string> = {
  acefone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  plivo:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  other:   'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

export default function PhoneNumbersPanel({ agentId, pipecatAgentId, agentName }: PhoneNumbersPanelProps) {
  const [numbers, setNumbers]     = useState<PhoneNumber[]>([])
  const [agents, setAgents]       = useState<Agent[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [msg, setMsg]             = useState<string | null>(null)

  // ── register form ──────────────────────────────────────────────────────────
  const [showForm, setShowForm]         = useState(false)
  const [formNumber, setFormNumber]     = useState('')
  const [formProvider, setFormProvider] = useState<string>('acefone')
  const [formCallTypes, setFormCallTypes] = useState<string>('inbound')
  const [formAgent, setFormAgent]       = useState(pipecatAgentId ?? agentId)
  const [formBusy, setFormBusy]         = useState(false)

  // ── per-row state ──────────────────────────────────────────────────────────
  const [busyRow, setBusyRow] = useState<string | null>(null)

  const flash = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 3000)
  }

  // ── load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const lookupId = pipecatAgentId ?? agentId
      const [numsRes, agentsRes] = await Promise.all([
        fetch(`/api/pipecat/numbers?agent_id=${lookupId}`),
        fetch('/api/pipecat/agents'),
      ])
      if (!numsRes.ok)   throw new Error(`Numbers: ${numsRes.status}`)
      if (!agentsRes.ok) throw new Error(`Agents: ${agentsRes.status}`)
      setNumbers(await numsRes.json())
      const agentsList = await agentsRes.json()
      setAgents(agentsList)
      // Ensure formAgent is set to a valid pipecat agent ID (not the Supabase ID)
      if (pipecatAgentId) {
        setFormAgent(prev => prev === agentId ? pipecatAgentId : prev)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [agentId, pipecatAgentId])

  useEffect(() => { load() }, [load])

  // ── register / assign ──────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNumber.trim()) return
    setFormBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/pipecat/numbers/${encodeURIComponent(formNumber.trim())}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id:   formAgent,
          call_types: formCallTypes,
          provider:   formProvider,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      flash('Number registered & assigned.')
      setFormNumber('')
      setShowForm(false)
      load()
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to register')
    } finally {
      setFormBusy(false)
    }
  }

  // ── unassign ───────────────────────────────────────────────────────────────
  const handleUnassign = async (number: string) => {
    if (!confirm(`Remove agent assignment from ${number}?`)) return
    setBusyRow(number)
    try {
      const res = await fetch(`/api/pipecat/numbers/${encodeURIComponent(number)}/assign`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      flash(`${number} unassigned.`)
      load()
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to unassign')
    } finally {
      setBusyRow(null)
    }
  }

  // ── delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (number: string) => {
    if (!confirm(`Remove ${number} from DB? This cannot be undone.`)) return
    setBusyRow(number)
    try {
      const res = await fetch(`/api/pipecat/numbers/${encodeURIComponent(number)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      flash(`${number} removed.`)
      load()
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setBusyRow(null)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Phone Numbers
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Numbers assigned to {agentName ?? agentId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}
            className="h-8 text-xs border-gray-200 dark:border-gray-700">
            <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm(v => !v)}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-3 h-3 mr-1.5" />
            Attach Number
          </Button>
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div className="px-4 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
          {msg}
        </div>
      )}

      {/* Register form */}
      {showForm && (
        <form onSubmit={handleRegister}
          className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 space-y-4">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Register existing number
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Number */}
            <div className="col-span-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                Phone number
              </label>
              <input
                value={formNumber}
                onChange={e => setFormNumber(e.target.value)}
                placeholder="e.g. 918065846383"
                required
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Provider */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Provider</label>
              <select value={formProvider} onChange={e => setFormProvider(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none
                           focus:ring-2 focus:ring-blue-500">
                {PROVIDERS.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            {/* Call types */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Call types</label>
              <select value={formCallTypes} onChange={e => setFormCallTypes(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none
                           focus:ring-2 focus:ring-blue-500">
                {CALL_TYPES.map(t => <option key={t} value={t}>{CALL_LABELS[t]}</option>)}
              </select>
            </div>
            {/* Agent */}
            <div className="col-span-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Assign to agent</label>
              <select value={formAgent} onChange={e => setFormAgent(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none
                           focus:ring-2 focus:ring-blue-500">
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}
              className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={formBusy}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {formBusy && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Register & Assign
            </Button>
          </div>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20
                        border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Numbers list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading numbers…</span>
        </div>
      ) : numbers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <Phone className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No numbers attached to this agent yet.</p>
          <p className="text-xs mt-1">Click "Attach Number" to register one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {numbers.map(n => (
            <div key={n.number}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200
                         dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-200
                         dark:hover:border-blue-800 transition-colors">
              {/* Left info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                    +{n.number.replace(/^\+/, '')}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md
                                    ${PROVIDER_COLORS[n.provider ?? 'other'] ?? PROVIDER_COLORS.other}`}>
                      {n.provider ?? 'unknown'}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {CALL_LABELS[n.call_types] ?? n.call_types}
                    </span>
                    {n.alias && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                        {n.alias}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {n.agent_id && (
                  <Button variant="outline" size="sm"
                    onClick={() => handleUnassign(n.number)}
                    disabled={busyRow === n.number}
                    className="h-7 text-xs border-orange-200 dark:border-orange-800 text-orange-600
                               dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                    {busyRow === n.number
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Unlink className="w-3 h-3 mr-1" />
                    }
                    Unassign
                  </Button>
                )}
                <Button variant="outline" size="sm"
                  onClick={() => handleDelete(n.number)}
                  disabled={busyRow === n.number}
                  className="h-7 text-xs border-red-200 dark:border-red-800 text-red-600
                             dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                  {busyRow === n.number
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3 mr-1" />
                  }
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
