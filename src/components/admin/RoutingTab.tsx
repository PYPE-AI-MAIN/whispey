'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminCall, post } from './adminApi'

const TYPES = ['call_data', 'recordings', 'campaigns', 'dnc', 'qa'] as const
const TOGETHER = ['call_data', 'qa', 'dnc']
type Dest = { id: string; name: string; status: string }
type Route = { data_type: string; destination_id: string; state: string; version: number }
type Project = { id: string; name: string; routes: Route[] }
type Plan = { ok: boolean; dryRun: boolean; plan?: string[]; activeCalls?: number; error?: string; routes?: unknown[] }

export function RoutingTab() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [choice, setChoice] = useState<Record<string, string>>({}) // data_type -> destination id ('' = Pype)
  const [confirmName, setConfirmName] = useState('')
  const [force, setForce] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)

  const projects = useQuery<{ projects: Project[] }>({ queryKey: ['admin', 'route-projects', q], queryFn: () => adminCall(`/api/admin/data-destinations/projects?q=${encodeURIComponent(q)}`) })
  const dests = useQuery<{ destinations: Dest[] }>({ queryKey: ['admin', 'destinations'], queryFn: () => adminCall('/api/admin/data-destinations') })

  const pick = (p: Project) => {
    setProject(p); setPlan(null); setConfirmName(''); setForce(false)
    setChoice(Object.fromEntries(p.routes.map((r) => [r.data_type, r.destination_id])))
  }
  // call data, QA and DNC share one destination, so choosing one sets all three
  const choose = (type: string, id: string) =>
    setChoice((c) => (TOGETHER.includes(type) ? { ...c, ...Object.fromEntries(TOGETHER.map((t) => [t, id])) } : { ...c, [type]: id }))

  const body = () => ({
    routes: TYPES.filter((t) => (choice[t] ?? '') !== (project?.routes.find((r) => r.data_type === t)?.destination_id ?? ''))
      .map((t) => ({ data_type: t, destination_id: choice[t] || null })),
    confirm: confirmName,
    force,
  })
  const run = useMutation({
    mutationFn: (dryRun: boolean) => post(`/api/admin/data-destinations/projects/${project!.id}${dryRun ? '?dryRun=1' : ''}`, body(), 'PUT'),
    onSuccess: (r: Plan, dryRun) => { setPlan(r); if (!dryRun) return qc.invalidateQueries({ queryKey: ['admin', 'route-projects'] }) },
    onError: (e: Error & { body?: Plan }) => setPlan({ ok: false, dryRun: false, error: e.message, activeCalls: e.body?.activeCalls }),
  })
  const state = useMutation({
    mutationFn: (action: 'pause' | 'resume') => post(`/api/admin/data-destinations/projects/${project!.id}/state`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'route-projects'] }),
  })
  const changes = body().routes.length

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-2">
        <Input placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="max-h-96 divide-y divide-border overflow-auto rounded-xl border border-border bg-card text-sm">
          {projects.data?.projects.map((p) => (
            <li key={p.id}>
              <button className={`w-full px-3 py-2 text-left ${project?.id === p.id ? 'bg-muted' : ''}`} onClick={() => pick(p)}>
                {p.name} {p.routes.length > 0 && <span className="text-xs text-muted-foreground">· {p.routes.some((r) => r.state === 'paused') ? 'paused' : 'routed'}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {project ? (
        <div className="space-y-4">
          <h2 className="font-medium">{project.name}</h2>
          <div className="space-y-2">
            {TYPES.map((t) => (
              <label key={t} className="grid grid-cols-[8rem_1fr] items-center gap-2 text-sm">
                <span>{t}</span>
                <select className="h-9 rounded-md border border-border bg-card px-2" value={choice[t] ?? ''} onChange={(e) => choose(t, e.target.value)}>
                  <option value="">Pype (default)</option>
                  {dests.data?.destinations.map((d) => (
                    <option key={d.id} value={d.id} disabled={d.status !== 'healthy'}>{d.name}{d.status !== 'healthy' ? ` (${d.status})` : ''}</option>
                  ))}
                </select>
              </label>
            ))}
            <p className="text-xs text-muted-foreground">Call data, QA and DNC move together. Campaigns can use a customer destination only together with call data on the same one. History is not moved: older calls and existing campaigns stay in Pype.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={!changes || run.isPending} onClick={() => run.mutate(true)}>Dry run</Button>
            {project.routes.length > 0 && (
              <>
                <Button variant="outline" onClick={() => state.mutate('pause')}>Pause routes</Button>
                <Button variant="outline" onClick={() => state.mutate('resume')}>Resume routes</Button>
              </>
            )}
          </div>
          {plan && (
            <div className={`rounded-lg border p-3 text-sm ${plan.ok ? 'border-border' : 'border-destructive text-destructive'}`}>
              {plan.error && <p>{plan.error}</p>}
              {plan.plan && <ol className="list-decimal pl-5">{plan.plan.map((s) => <li key={s}>{s}</li>)}</ol>}
              {plan.dryRun && <p className="mt-1 text-xs text-muted-foreground">Dry run: nothing changed; the entry is in the audit log marked dry run.</p>}
              {plan.ok && !plan.dryRun && <p className="mt-1">Applied.</p>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-xs" placeholder={`Type “${project.name}” to apply`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> apply even if calls are still active</label>
            <Button disabled={!changes || confirmName !== project.name || run.isPending} onClick={() => run.mutate(false)}>
              {run.isPending ? 'Applying…' : 'Apply'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Pick a project.</p>
      )}
    </div>
  )
}
