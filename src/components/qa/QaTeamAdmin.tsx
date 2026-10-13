'use client'

/** Super admin: who is on the QA team / a prompt engineer, and their Slack member ID. */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Member = { id: string; name: string; email: string; role: 'qa' | 'prompt_engineer'; slack_id: string | null }
const ROLE_LABEL = { qa: 'QA team', prompt_engineer: 'Prompt engineer' }

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Something went wrong')
  return json
}

export function QaTeamAdmin() {
  const qc = useQueryClient()
  const key = ['admin', 'qa-team']
  const { data, isLoading } = useQuery<{ members: Member[] }>({ queryKey: key, queryFn: () => call('/api/admin/qa-team') })
  const [form, setForm] = useState({ name: '', email: '', role: 'prompt_engineer', slack_id: '' })
  const add = useMutation({
    mutationFn: () => call('/api/admin/qa-team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm({ ...form, name: '', email: '', slack_id: '' })
      return qc.invalidateQueries({ queryKey: key })
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => call(`/api/admin/qa-team?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">
        QA team members can update flagged calls. Prompt engineers can be assigned a flag, and are emailed and tagged on Slack when it goes in review.
        Slack ID: Slack profile → More → Copy member ID.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto_1fr_auto]">
        <Input placeholder="Name" value={form.name} onChange={set('name')} />
        <Input placeholder="Email" value={form.email} onChange={set('email')} />
        <select className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={form.role} onChange={set('role')}>
          <option value="prompt_engineer">Prompt engineer</option>
          <option value="qa">QA team</option>
        </select>
        <Input placeholder="Slack ID (U0123ABCD)" value={form.slack_id} onChange={set('slack_id')} />
        <Button onClick={() => add.mutate()} disabled={add.isPending}>Add</Button>
      </div>
      {add.isError && <p className="text-xs text-red-600">{(add.error as Error).message}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {isLoading && <li className="px-4 py-3 text-sm text-muted-foreground">Loading…</li>}
        {data?.members.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No one added yet.</li>}
        {data?.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{m.name} <span className="ml-2 text-xs font-normal text-muted-foreground">{ROLE_LABEL[m.role]}</span></p>
              <p className="truncate text-xs text-muted-foreground">{m.email} · {m.slack_id ?? 'no Slack ID'}</p>
            </div>
            <button type="button" aria-label={`Remove ${m.name}`} onClick={() => remove.mutate(m.id)} className="text-muted-foreground hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
