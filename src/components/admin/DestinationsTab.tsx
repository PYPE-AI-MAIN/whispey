'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminCall, post } from './adminApi'

type Dest = { id: string; name: string; kind: string; has_secret: boolean; schema_version: number; status: string; last_health_at: string | null; route_count: number; config: Record<string, unknown> }
type Check = { name: string; ok: boolean; detail?: string }

export function DestinationsTab() {
  const qc = useQueryClient()
  const key = ['admin', 'destinations']
  const { data, isLoading } = useQuery<{ destinations: Dest[] }>({ queryKey: key, queryFn: () => adminCall('/api/admin/data-destinations') })
  const [form, setForm] = useState({ name: '', base_url: '', audience: '', kid: '', secret_ref: '' })
  const [checks, setChecks] = useState<Record<string, Check[]>>({})
  const refresh = () => qc.invalidateQueries({ queryKey: key })

  const attach = useMutation({
    mutationFn: () => post('/api/admin/data-destinations', { name: form.name, kind: 'postgrest', config: { base_url: form.base_url, ...(form.audience && { audience: form.audience }), ...(form.kid && { kid: form.kid }) }, secret_ref: form.secret_ref || null }),
    onSuccess: () => { setForm({ name: '', base_url: '', audience: '', kid: '', secret_ref: '' }); return refresh() },
  })
  const verify = useMutation({
    mutationFn: (id: string) => post(`/api/admin/data-destinations/${id}/verify`, {}),
    onSuccess: (r: { checks: Check[] }, id) => { setChecks((c) => ({ ...c, [id]: r.checks })); return refresh() },
  })
  const remove = useMutation({ mutationFn: (id: string) => adminCall(`/api/admin/data-destinations/${id}`, { method: 'DELETE' }), onSuccess: refresh })
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-[1fr_1.6fr_1fr_1fr_1.6fr_auto]">
        <Input placeholder="Name (acme-prod)" value={form.name} onChange={set('name')} />
        <Input placeholder="Base URL (https://…)" value={form.base_url} onChange={set('base_url')} />
        <Input placeholder="Audience (optional)" value={form.audience} onChange={set('audience')} />
        <Input placeholder="Key ID (kid)" value={form.kid} onChange={set('kid')} />
        <Input placeholder="Secret ARN (arn:aws:secretsmanager:…)" value={form.secret_ref} onChange={set('secret_ref')} />
        <Button onClick={() => attach.mutate()} disabled={attach.isPending}>Attach</Button>
      </div>
      <p className="text-xs text-muted-foreground">Secrets are stored by reference only. After attaching, run Verify; a destination must be healthy before a project can use it.</p>
      {[attach, verify, remove].map((m, i) => m.isError && <p key={i} className="text-xs text-destructive">{(m.error as Error).message}</p>)}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {isLoading && <li className="px-4 py-3 text-sm text-muted-foreground">Loading…</li>}
        {data?.destinations.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No destinations yet.</li>}
        {data?.destinations.map((d) => (
          <li key={d.id} className="space-y-2 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium">{d.name}</span>{' '}
                <span className="text-muted-foreground">{d.kind} · schema v{d.schema_version} · {d.status} · {d.route_count} route{d.route_count === 1 ? '' : 's'}
                  {d.last_health_at ? ` · checked ${new Date(d.last_health_at).toLocaleString()}` : ''}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => verify.mutate(d.id)} disabled={verify.isPending}>Verify</Button>
                <Button size="sm" variant="outline" disabled={d.route_count > 0} title={d.route_count > 0 ? 'Remove its routes first' : undefined} onClick={() => confirm(`Delete ${d.name}?`) && remove.mutate(d.id)}>Delete</Button>
              </div>
            </div>
            {checks[d.id] && (
              <ul className="space-y-0.5 text-xs">
                {checks[d.id].map((c) => (
                  <li key={c.name} className={c.ok ? 'text-green-600' : 'text-destructive'}>
                    {c.ok ? '✓' : '✗'} {c.name}{c.detail ? ` — ${c.detail}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
