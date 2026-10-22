'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type { AgentOption } from './dncShared'

/**
 * One organization's agents: each one's DNC checker switch, and how many
 * numbers it has blocked (which opens them on the Numbers tab).
 */
export function DncAgentsPanel({
  projectId,
  countsByAgent,
  onShowNumbers,
}: Readonly<{
  projectId: string
  countsByAgent: Map<string, number>
  onShowNumbers: (agentId: string) => void
}>) {
  const queryClient = useQueryClient()
  const key = ['dnc-agents', projectId]
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/dnc/agents?project_id=${projectId}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to load agents')
      return json as { agents: AgentOption[] }
    },
    staleTime: 30_000,
    retry: false,
  })
  const agents = data?.agents ?? []

  const toggle = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const res = await fetch('/api/dnc/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: id, dnc_checker_enabled: on }),
      })
      if (!res.ok) throw new Error('Could not update the agent')
    },
    // flip it straight away; put it back if the save fails
    onMutate: async ({ id, on }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<{ agents: AgentOption[] }>(key)
      queryClient.setQueryData<{ agents: AgentOption[] }>(key, (old) =>
        old ? { agents: old.agents.map((a) => (a.id === id ? { ...a, dnc_checker_enabled: on } : a)) } : old,
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous)
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-panel)] py-12">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--cl-text3)]" />
      </div>
    )
  }
  if (error) {
    return (
      <p role="alert" className="rounded-2xl border border-[var(--cl-red-line)] bg-[var(--cl-red-soft)] px-4 py-3 text-[13px] text-[var(--cl-red-text)]">
        Couldn&apos;t load the agents: {(error as Error).message}
      </p>
    )
  }
  if (agents.length === 0) {
    return (
      <p className="rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-panel)] px-4 py-10 text-center text-[13px] text-[var(--cl-text3)]">
        No active agents in this organization.
      </p>
    )
  }

  const onCount = agents.filter((a) => a.dnc_checker_enabled).length
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--cl-border)] bg-[var(--cl-panel2)] px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[.06em] text-[var(--cl-text3)]">
        <span>Agent</span>
        <span className="normal-case tracking-normal font-normal">Checker on for {onCount} of {agents.length}</span>
      </div>
      <ul className="divide-y divide-[var(--cl-border)]">
        {agents.map((a) => {
          const count = countsByAgent.get(a.id) ?? 0
          return (
            <li key={a.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--cl-hover)]">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{a.name}</span>
                <span className="block text-[12px] text-[var(--cl-text3)]">
                  {a.dnc_checker_enabled ? 'Adds callers who ask not to be called' : 'Not checking calls'}
                </span>
              </span>
              {count > 0 ? (
                <button
                  type="button"
                  onClick={() => onShowNumbers(a.id)}
                  className="shrink-0 text-[12.5px] font-medium text-[var(--cl-accent-text)] hover:underline"
                >
                  View {count} {count === 1 ? 'number' : 'numbers'}
                </button>
              ) : (
                <span className="shrink-0 text-[12.5px] text-[var(--cl-text3)]">No numbers</span>
              )}
              <Switch
                checked={a.dnc_checker_enabled}
                onCheckedChange={(on) => toggle.mutate({ id: a.id, on })}
                aria-label={`DNC checker for ${a.name}`}
              />
            </li>
          )
        })}
      </ul>
      {toggle.isError && (
        <p role="alert" className="border-t border-[var(--cl-border)] px-4 py-2 text-[12.5px] text-[var(--cl-red-text)]">
          {(toggle.error as Error).message}
        </p>
      )}
    </section>
  )
}
