'use client'

/**
 * Who gets QA email — Confluence "Automated Call QA — Design" §10.
 *
 * Any address, not just Whispey users: the person who most needs to know the
 * booking flow is dropping people often never logs in. They never verify
 * anything; our sending domain is verified once and that is the whole of it.
 *
 * The contents switch is the setting that earns its place. An ops lead wants to
 * know what is costing them; a prompt engineer wants the diff.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Mail, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type Sub = {
  id: string
  email: string
  agent_id: string | null
  cadence: 'as_it_happens' | 'daily' | 'weekly' | 'campaign_end'
  contents: 'insights' | 'insights_and_prompts'
  active: boolean
  created_by: string | null
}

const CADENCE: Record<Sub['cadence'], string> = {
  as_it_happens: 'As it happens',
  daily: 'Daily digest',
  weekly: 'Weekly',
  campaign_end: 'When a campaign finishes',
}

export default function QaSubscriptions({
  projectId, agents = [], lockAgentId,
}: Readonly<{ projectId: string; agents?: Array<{ id: string; name: string }>; lockAgentId?: string }>) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [agentId, setAgentId] = useState<string>(lockAgentId ?? 'all')
  const [cadence, setCadence] = useState<Sub['cadence']>('as_it_happens')
  const [contents, setContents] = useState<Sub['contents']>('insights')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ subscriptions: Sub[]; canWrite: boolean }>({
    queryKey: ['qa', 'subs', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/qa/subscriptions?projectId=${projectId}`)
      if (!res.ok) throw new Error('Could not load subscriptions')
      return res.json()
    },
    enabled: Boolean(projectId),
  })

  const add = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/qa/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          email: email.trim(),
          agentId: agentId === 'all' ? null : agentId,
          cadence,
          contents,
        }),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => ({})))?.error || 'Could not add that address')
        return
      }
      setEmail('')
      qc.invalidateQueries({ queryKey: ['qa', 'subs', projectId] })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    await fetch(`/api/qa/subscriptions?id=${id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['qa', 'subs', projectId] })
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />

  const canWrite = data?.canWrite ?? false
  const agentName = (id: string | null) => (id ? agents.find((a) => a.id === id)?.name ?? 'an agent' : 'Every agent')
  // Locked to one agent: a project-wide sub (agent_id null) still mails this
  // agent too, so it stays visible — everything scoped to a different agent
  // does not belong on this screen.
  const subs = (data?.subscriptions ?? []).filter(
    (s) => !lockAgentId || !s.agent_id || s.agent_id === lockAgentId,
  )

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          {lockAgentId ? `QA email for ${agentName(lockAgentId)}` : 'QA email'}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Mail goes out only when there is something to say, and only between 10am and 7pm.
          A quiet week sends nothing.
        </p>
      </div>

      {canWrite && (
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className={`grid gap-3 sm:grid-cols-2 ${lockAgentId ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500">Email address</label>
              <Input
                type="email"
                placeholder="anyone@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!lockAgentId && (
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-gray-500">For</label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Every agent</SelectItem>
                    {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-500">How often</label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as Sub['cadence'])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CADENCE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-500">What it contains</label>
              <Select value={contents} onValueChange={(v) => setContents(v as Sub['contents'])}>
                <SelectTrigger className="w-full"><SelectValue className="truncate" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insights">Insights only — what changed and what it costs</SelectItem>
                  <SelectItem value="insights_and_prompts">Insights and suggested prompt changes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={add} disabled={busy || !email.trim()}>
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                Add
              </Button>
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      {subs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center dark:border-gray-800">
          <Mail className="mx-auto h-6 w-6 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nobody is getting QA email yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.email}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {agentName(s.agent_id)} · {CADENCE[s.cadence]} ·{' '}
                  {s.contents === 'insights_and_prompts' ? 'with prompt changes' : 'insights only'}
                </p>
              </div>
              {canWrite && (
                <Button variant="ghost" size="sm" onClick={() => remove(s.id)} aria-label={`Remove ${s.email}`}>
                  <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
