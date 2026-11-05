'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminCall, post } from './adminApi'

type Entry = { id: number; at: string; actor_email: string; action: string; project_id: string | null; data_type: string | null; before: unknown; after: unknown; dry_run: boolean }

export function AuditTab() {
  const [f, setF] = useState({ projectId: '', actor: '', action: '' })
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString()
  const { data, isLoading } = useQuery<{ entries: Entry[] }>({ queryKey: ['admin', 'audit', qs], queryFn: () => adminCall(`/api/admin/data-destinations/audit?${qs}`) })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Project id" value={f.projectId} onChange={set('projectId')} />
        <Input placeholder="Actor email" value={f.actor} onChange={set('actor')} />
        <Input placeholder="Action (route_change, pause, …)" value={f.action} onChange={set('action')} />
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
        {isLoading && <li className="px-4 py-3 text-muted-foreground">Loading…</li>}
        {data?.entries.length === 0 && <li className="px-4 py-3 text-muted-foreground">No entries.</li>}
        {data?.entries.map((e) => (
          <li key={e.id} className="px-4 py-2">
            <div><span className="font-medium">{e.action}</span>{e.dry_run ? ' (dry run)' : ''} · {e.actor_email} · {new Date(e.at).toLocaleString()}{e.project_id ? ` · ${e.project_id}` : ''}</div>
            {(e.before != null || e.after != null) && <pre className="mt-1 overflow-auto text-xs text-muted-foreground">{JSON.stringify({ before: e.before, after: e.after })}</pre>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function KillSwitch() {
  const run = useMutation({ mutationFn: (action: 'pause' | 'resume') => post('/api/admin/data-destinations/kill-switch', { action }) })
  return (
    <div className="max-w-xl space-y-3 text-sm">
      <p>Pauses every route that points at a customer destination. Their writes are refused with “try again” and callers retry. Nothing falls back to Pype. Pype-held projects are not affected.</p>
      <div className="flex gap-2">
        <Button variant="destructive" disabled={run.isPending} onClick={() => confirm('Pause ALL customer routes?') && run.mutate('pause')}>Pause all customer routes</Button>
        <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate('resume')}>Resume all</Button>
      </div>
      {run.isSuccess && <p className="text-muted-foreground">Done: {(run.data as { routes: number }).routes} routes now {(run.data as { state: string }).state}.</p>}
      {run.isError && <p className="text-destructive">{(run.error as Error).message}</p>}
    </div>
  )
}
