'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowLeft, Phone, Plus, Pencil, Trash2, Eye, EyeOff, X, Check, Loader2, BookOpen, ExternalLink,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface PhoneNumber {
  id: string
  phone_number: string
  number_type: string
  provider: string
  telephony_type?: string
  assigned_agent_id?: string | null
  assigned_agent_name?: string | null
  status: string
  acefone_api_key?: string | null
  trunk_direction?: string
}

interface Agent {
  id: string
  name: string
}

type NumberType = 'inbound_only' | 'outbound_only' | 'both'
type Provider = 'acefone' | 'plivo' | 'other'

interface FormState {
  phone_number: string
  provider: Provider
  number_type: NumberType
  acefone_api_key: string
  assigned_agent_id: string
  assigned_agent_name: string
  sip_trunk_url: string
  sip_username: string
  sip_password: string
}

const EMPTY_FORM: FormState = {
  phone_number: '',
  provider: 'acefone',
  number_type: 'both',
  acefone_api_key: '',
  assigned_agent_id: '',
  assigned_agent_name: '',
  sip_trunk_url: '',
  sip_username: '',
  sip_password: '',
}

const PROVIDER_LABELS: Record<Provider, string> = {
  acefone: 'Acefone',
  plivo: 'Plivo',
  other: 'Other',
}

const NUMBER_TYPE_LABELS: Record<NumberType, string> = {
  inbound_only: 'Inbound only',
  outbound_only: 'Outbound only',
  both: 'Both',
}

// Maps our UI NumberType to DB trunk_direction values
const NUMBER_TYPE_TO_TRUNK: Record<NumberType, string> = {
  inbound_only: 'inbound',
  outbound_only: 'outbound',
  both: 'bidirectional',
}

const TRUNK_TO_NUMBER_TYPE: Record<string, NumberType> = {
  inbound: 'inbound_only',
  outbound: 'outbound_only',
  bidirectional: 'both',
}

// ── Inline select ─────────────────────────────────────────────────────────────

function NativeSelect({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`h-9 w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-200 px-3 focus:outline-none focus:border-blue-600 transition-colors ${className}`}
    >
      {children}
    </select>
  )
}

// ── Form ──────────────────────────────────────────────────────────────────────

function PhoneNumberForm({
  initial,
  agents,
  onSubmit,
  onCancel,
  isPending,
  isEdit,
}: {
  initial: FormState
  agents: Agent[]
  onSubmit: (f: FormState) => void
  onCancel: () => void
  isPending: boolean
  isEdit: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [showKey, setShowKey] = useState(false)

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleAgentChange = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    setForm(f => ({
      ...f,
      assigned_agent_id: agentId,
      assigned_agent_name: agent?.name ?? '',
    }))
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-100">
        {isEdit ? 'Edit Phone Number' : 'Add Phone Number'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Phone Number */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400">Phone Number</label>
          <input
            value={form.phone_number}
            onChange={e => set('phone_number', e.target.value)}
            placeholder="918064151286"
            disabled={isEdit}
            className="h-9 w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-200 px-3 placeholder:text-gray-600 focus:outline-none focus:border-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Provider */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400">Provider</label>
          <NativeSelect value={form.provider} onChange={v => set('provider', v as Provider)}>
            {(Object.keys(PROVIDER_LABELS) as Provider[]).map(p => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </NativeSelect>
        </div>

        {/* Number Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400">Number Type</label>
          <NativeSelect value={form.number_type} onChange={v => set('number_type', v as NumberType)}>
            {(Object.keys(NUMBER_TYPE_LABELS) as NumberType[]).map(t => (
              <option key={t} value={t}>{NUMBER_TYPE_LABELS[t]}</option>
            ))}
          </NativeSelect>
        </div>

        {/* Assign to Agent */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400">Assign to Agent</label>
          <NativeSelect value={form.assigned_agent_id} onChange={handleAgentChange}>
            <option value="">— Unassigned —</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </NativeSelect>
        </div>

        {/* Acefone API Key — only when provider is acefone */}
        {form.provider.toLowerCase() === 'acefone' && (
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Acefone C2C API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.acefone_api_key}
                onChange={e => set('acefone_api_key', e.target.value)}
                placeholder="5f0d3b62-..."
                className="h-9 w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-200 px-3 pr-10 placeholder:text-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Plivo fields */}
        {form.provider.toLowerCase() === 'plivo' && (
          <>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Plivo Auth ID</label>
              <input
                value={form.sip_username}
                onChange={e => set('sip_username', e.target.value)}
                placeholder="MAXXXXXXXXXXXXXXXX"
                className="h-9 w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-200 px-3 placeholder:text-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Plivo Auth Token</label>
              <input
                type="password"
                value={form.sip_password}
                onChange={e => set('sip_password', e.target.value)}
                placeholder="••••••••••••••••••••"
                className="h-9 w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-200 px-3 placeholder:text-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
              />
            </div>
          </>
        )}

        {/* SIP / Other trunk fields */}
        {form.provider.toLowerCase() === 'other' && (
          <>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-400">SIP Trunk URL</label>
              <input
                value={form.sip_trunk_url}
                onChange={e => set('sip_trunk_url', e.target.value)}
                placeholder="sip:trunk.example.com"
                className="h-9 w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-200 px-3 placeholder:text-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">SIP Username</label>
              <input
                value={form.sip_username}
                onChange={e => set('sip_username', e.target.value)}
                placeholder="username"
                className="h-9 w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-200 px-3 placeholder:text-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">SIP Password</label>
              <input
                type="password"
                value={form.sip_password}
                onChange={e => set('sip_password', e.target.value)}
                placeholder="••••••••"
                className="h-9 w-full rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-200 px-3 placeholder:text-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSubmit(form)}
          disabled={isPending || !form.phone_number.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Add Number'}
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PhoneNumbersPage() {
  const { projectid: projectId } = useParams<{ projectid: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [showDocs, setShowDocs] = useState(false)
  // Reassign confirm state: holds { numberId, form, conflictNumber } when a conflict is detected
  const [reassignConfirm, setReassignConfirm] = useState<{
    numberId: string
    form: FormState
    conflictPhone: string
    conflictNumberId: string
  } | null>(null)

  // ── Queries ──
  const { data: numbers = [], isLoading } = useQuery<PhoneNumber[]>({
    queryKey: ['phone-numbers', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/phone-numbers/available?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch phone numbers')
      const raw: PhoneNumber[] = await res.json()
      // Deduplicate by phone_number — prefer rows with assigned_agent_id
      const map = new Map<string, PhoneNumber>()
      for (const n of raw) {
        const existing = map.get(n.phone_number)
        if (!existing || (!existing.assigned_agent_id && n.assigned_agent_id)) {
          map.set(n.phone_number, n)
        }
      }
      return Array.from(map.values())
    },
    staleTime: 15_000,
  })

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/agents?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch agents')
      const data = await res.json()
      // API returns { agents: [...] }
      return Array.isArray(data) ? data : (data.agents ?? [])
    },
    staleTime: 30_000,
  })

  // ── Mutations ──
  const addMutation = useMutation({
    mutationFn: async (form: FormState) => {
      const res = await fetch('/api/phone-numbers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          trunk_direction: NUMBER_TYPE_TO_TRUNK[form.number_type],
          project_id: projectId,
          ...(form.provider === 'plivo' || form.provider === 'other' ? {
            custom_headers: {
              sip_trunk_url: form.sip_trunk_url || null,
              sip_username: form.sip_username || null,
              sip_password: form.sip_password || null,
            }
          } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to add number')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-numbers', projectId] })
      setShowAddForm(false)
    },
  })

  const doEditMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: FormState }) => {
      const res = await fetch(`/api/phone-numbers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          acefone_api_key: form.provider === 'acefone' ? form.acefone_api_key || null : null,
          assigned_agent_id: form.assigned_agent_id || null,
          assigned_agent_name: form.assigned_agent_name || null,
          trunk_direction: NUMBER_TYPE_TO_TRUNK[form.number_type],
          provider: form.provider,
          ...(form.provider === 'plivo' || form.provider === 'other' ? {
            custom_headers: {
              sip_trunk_url: form.sip_trunk_url || null,
              sip_username: form.sip_username || null,
              sip_password: form.sip_password || null,
            }
          } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to update number')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-numbers', projectId] })
      setEditingId(null)
      setReassignConfirm(null)
    },
  })

  // Wrapper that checks for agent conflict before mutating
  const editMutation = {
    ...doEditMutation,
    mutate: ({ id, form }: { id: string; form: FormState }) => {
      if (form.assigned_agent_id) {
        const conflict = numbers.find(
          n => n.id !== id && n.assigned_agent_id === form.assigned_agent_id
        )
        if (conflict) {
          setReassignConfirm({ numberId: id, form, conflictPhone: conflict.phone_number, conflictNumberId: conflict.id })
          return
        }
      }
      doEditMutation.mutate({ id, form })
    },
  }

  const confirmReassign = async () => {
    if (!reassignConfirm) return
    // Unassign from old number first
    await fetch(`/api/phone-numbers/${reassignConfirm.conflictNumberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        assigned_agent_id: null,
        assigned_agent_name: null,
      }),
    })
    doEditMutation.mutate({ id: reassignConfirm.numberId, form: reassignConfirm.form })
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/phone-numbers/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to delete number')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-numbers', projectId] })
      setDeletingId(null)
    },
  })

  // ── Helpers ──
  const toggleKeyReveal = (id: string) => {
    setRevealedKeys(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const numberToForm = (n: PhoneNumber): FormState => ({
    phone_number: n.phone_number,
    provider: ((n.provider?.toLowerCase()) as Provider) ?? 'other',
    number_type: TRUNK_TO_NUMBER_TYPE[n.trunk_direction ?? ''] ?? 'both',
    acefone_api_key: n.acefone_api_key ?? '',
    assigned_agent_id: n.assigned_agent_id ?? '',
    assigned_agent_name: n.assigned_agent_name ?? '',
    sip_trunk_url: (n as PhoneNumber & { sip_trunk_url?: string }).sip_trunk_url ?? '',
    sip_username: (n as PhoneNumber & { sip_username?: string }).sip_username ?? '',
    sip_password: '',
  })

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-900">

      {/* ── Navbar ── */}
      <div className="flex-shrink-0 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/${projectId}/agents`)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-900/40 border border-blue-800/50 flex items-center justify-center">
                <Phone className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <h1 className="text-sm font-semibold text-gray-100">Phone Numbers</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDocs(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" /> Setup Guide
            </button>
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Number
          </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Add form */}
          {showAddForm && (
            <PhoneNumberForm
              initial={EMPTY_FORM}
              agents={agents}
              onSubmit={form => addMutation.mutate(form)}
              onCancel={() => setShowAddForm(false)}
              isPending={addMutation.isPending}
              isEdit={false}
            />
          )}

          {/* Reassign confirm banner */}
          {reassignConfirm && (
            <div className="rounded-lg border border-yellow-700 bg-yellow-900/20 px-4 py-3 text-xs text-yellow-300 flex items-center justify-between gap-4">
              <span>
                This agent is already assigned to <span className="font-mono font-semibold">{reassignConfirm.conflictPhone}</span>.
                Reassign to this number instead?
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={confirmReassign}
                  disabled={doEditMutation.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-600 text-white hover:bg-yellow-500 disabled:opacity-50 transition-colors"
                >
                  {doEditMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Yes, reassign
                </button>
                <button
                  onClick={() => setReassignConfirm(null)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-yellow-400 hover:text-yellow-200 hover:bg-yellow-900/40 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Error banner */}
          {(addMutation.error || doEditMutation.error || deleteMutation.error) && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-2.5 text-xs text-red-400">
              {((addMutation.error || doEditMutation.error || deleteMutation.error) as Error).message}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '180px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '80px' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  {['Phone Number', 'Provider', 'Type', 'Assigned Agent', 'API Key', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 bg-gray-800 rounded w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : numbers.length === 0
                  ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-2 text-gray-600">
                            <Phone className="h-6 w-6" />
                            <span className="text-sm">No phone numbers yet</span>
                            <button
                              onClick={() => setShowAddForm(true)}
                              className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
                            >
                              Add your first number
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  : numbers.map(n => {
                      const isEditing = editingId === n.id
                      const isDeleting = deletingId === n.id
                      const keyRevealed = revealedKeys.has(n.id)

                      if (isEditing) {
                        return (
                          <tr key={n.id}>
                            <td colSpan={6} className="px-4 py-3">
                              <PhoneNumberForm
                                initial={numberToForm(n)}
                                agents={agents}
                                onSubmit={form => editMutation.mutate({ id: n.id, form })}
                                onCancel={() => setEditingId(null)}
                                isPending={editMutation.isPending}
                                isEdit
                              />
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={n.id} className="transition-colors hover:bg-gray-800/50">
                          {/* Phone Number */}
                          <td className="px-4 py-3 text-sm text-gray-200 font-mono truncate">
                            {n.phone_number}
                          </td>

                          {/* Provider */}
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-700 text-gray-300 border border-gray-600">
                              {PROVIDER_LABELS[(n.provider as Provider)] ?? n.provider}
                            </span>
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3 text-[11px] text-gray-400">
                            {NUMBER_TYPE_LABELS[(n.number_type as NumberType)] ?? n.number_type}
                          </td>

                          {/* Assigned Agent */}
                          <td className="px-4 py-3 text-sm text-gray-400 truncate">
                            {n.assigned_agent_name
                              ? <span className="text-gray-200">{n.assigned_agent_name}</span>
                              : <span className="text-gray-600 text-xs italic">Unassigned</span>
                            }
                          </td>

                          {/* API Key */}
                          <td className="px-4 py-3">
                            {n.acefone_api_key ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono text-gray-400 truncate max-w-[100px]">
                                  {keyRevealed ? n.acefone_api_key : '••••••••'}
                                </span>
                                <button
                                  onClick={() => toggleKeyReveal(n.id)}
                                  className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
                                >
                                  {keyRevealed
                                    ? <EyeOff className="h-3.5 w-3.5" />
                                    : <Eye className="h-3.5 w-3.5" />
                                  }
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-700 text-xs">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            {isDeleting ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-gray-500 mr-1">Delete?</span>
                                <button
                                  onClick={() => deleteMutation.mutate(n.id)}
                                  disabled={deleteMutation.isPending}
                                  className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40"
                                >
                                  {deleteMutation.isPending
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Check className="h-3.5 w-3.5" />
                                  }
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-700 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {n.provider?.toLowerCase() === 'acefone' && (
                                  <button
                                    onClick={() => { setEditingId(n.id); setShowAddForm(false) }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setDeletingId(n.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Acefone Setup Guide Sheet ── */}
      {showDocs && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDocs(false)} />
          <div className="relative w-full max-w-lg bg-gray-900 border-l border-gray-800 h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <BookOpen className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-gray-100">Acefone Setup Guide</h2>
              </div>
              <button onClick={() => setShowDocs(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-6 text-sm">

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400">Inbound Calls</h3>
                <p className="text-gray-400 text-xs">Set the <strong className="text-gray-200">Static Endpoint</strong> for your inbound DID in the Acefone dashboard:</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">WebSocket stream (audio)</p>
                    <code className="block bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-green-400 font-mono break-all">wss://your-bridge-domain/bridge</code>
                    <p className="text-[11px] text-gray-500 mt-1">⚠️ Use <span className="text-yellow-400">wss://</span> with a domain in production</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Prewarm webhook (Call received on Server)</p>
                    <code className="block bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-green-400 font-mono break-all">https://your-bridge-domain/acefone/inbound-prewarm</code>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Hangup webhook</p>
                    <code className="block bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-green-400 font-mono break-all">https://your-bridge-domain/acefone/hangup</code>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400">Outbound Calls (Campaigns)</h3>
                <p className="text-gray-400 text-xs">Set the <strong className="text-gray-200">Dynamic Endpoint</strong> mode in Acefone:</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">WebSocket stream (audio)</p>
                    <code className="block bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-green-400 font-mono break-all">wss://your-bridge-domain/bridge</code>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Dynamic endpoint</p>
                    <code className="block bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-green-400 font-mono break-all">https://your-bridge-domain/dynamic-endpoint</code>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Hangup webhook</p>
                    <code className="block bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-green-400 font-mono break-all">https://your-bridge-domain/acefone/hangup</code>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400">API Keys</h3>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                    <p><span className="text-gray-200 font-medium">C2C API Key</span> — For outbound campaigns. Found in Acefone dashboard → API settings. Format: <code className="text-green-400">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code></p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                    <p><span className="text-gray-200 font-medium">Acefone Token (JWT)</span> — For mid-call transfer only. Set in agent → Tools &amp; Actions → Transfer Call. Format: <code className="text-green-400">eyJ...long-jwt-string</code></p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400">Important Notes</h3>
                <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside">
                  <li>Use <code className="text-yellow-400">ws://</code> for dev/testing, <code className="text-yellow-400">wss://</code> for production</li>
                  <li>Replace <code className="text-gray-300">your-bridge-domain</code> with your actual bridge server URL (shared by your admin)</li>
                  <li>Inbound → <strong className="text-gray-200">Static</strong> endpoint mode in Acefone</li>
                  <li>Outbound → <strong className="text-gray-200">Dynamic</strong> endpoint mode in Acefone</li>
                  <li>Transfer auth header: raw JWT, <strong className="text-red-400">no &quot;Bearer&quot; prefix</strong></li>
                </ul>
              </section>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
