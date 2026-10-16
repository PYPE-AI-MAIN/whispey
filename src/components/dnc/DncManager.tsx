'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, ChevronDown, ChevronsUpDown, Loader2, PhoneOff, Plus, Search, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import { cn } from '@/lib/utils'
import { V2_BTN, V2_THEME } from '@/components/calls/v2/theme'
import { DncAddDialog } from '@/components/dnc/DncAddDialog'
import { DncAgentsPanel } from '@/components/dnc/DncAgentsPanel'
import { DncTable } from '@/components/dnc/DncTable'
import type { DncEntry, DncScope, ProjectOption } from '@/components/dnc/dncShared'

type Tab = 'numbers' | 'auto' | 'agents'
type ScopeFilter = 'all' | DncScope

const SCOPE_LABEL: Record<ScopeFilter, string> = {
  all: 'Blocked for anyone',
  agent: 'One agent',
  project: 'Organization',
  global: 'Everyone',
}

function TabButton({ active, onClick, children }: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors',
        active ? 'border-[var(--cl-text)] text-[var(--cl-text)]' : 'border-transparent text-[var(--cl-text3)] hover:text-[var(--cl-text)]',
      )}
    >
      {children}
    </button>
  )
}

const Count = ({ n }: Readonly<{ n: number }>) => (
  <span className="tabular-nums text-[12px] font-normal text-[var(--cl-text3)]">{n.toLocaleString()}</span>
)

/**
 * The Do Not Call list, for superadmins: every blocked number with who it's
 * blocked for, numbers the DNC checker added, and each agent's checker switch.
 * Lives on the Settings → Do Not Call tab.
 */
export function DncManager({ currentProjectId }: Readonly<{ currentProjectId: string | null }>) {
  const queryClient = useQueryClient()
  const { isSuperAdmin } = useGlobalRole()

  const [tab, setTab] = useState<Tab>('numbers')
  const [addOpen, setAddOpen] = useState(false)
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [orgId, setOrgId] = useState<string | null>(currentProjectId ?? null)
  const [orgOpen, setOrgOpen] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: projectsData } = useQuery({
    queryKey: ['dnc-projects'],
    queryFn: async () => {
      const res = await fetch('/api/dnc/projects')
      if (!res.ok) throw new Error('Failed to load organizations')
      return (await res.json()) as { projects: ProjectOption[] }
    },
    enabled: isSuperAdmin,
    staleTime: 60_000,
  })

  // The whole list (newest 1000); every filter works on it in the browser.
  const { data, isLoading, error } = useQuery({
    queryKey: ['dnc-list'],
    queryFn: async () => {
      const res = await fetch('/api/dnc/list')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to load the DNC list')
      return json as { entries: DncEntry[]; total: number; limit: number }
    },
    enabled: isSuperAdmin,
    retry: false,
  })
  const entries = useMemo(() => data?.entries ?? [], [data])

  // Organizations to pick from: the ones this admin works in, plus any that have entries.
  const orgs = useMemo(() => {
    const byId = new Map<string, string>()
    for (const p of projectsData?.projects ?? []) byId.set(p.id, p.name)
    for (const e of entries) if (e.project_id && e.project_name && !byId.has(e.project_id)) byId.set(e.project_id, e.project_name)
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [projectsData, entries])
  const org = orgs.find((o) => o.id === orgId) ?? null

  // An organization shows its own entries and its agents'; "everyone" entries apply there too.
  const inOrg = useMemo(
    () => entries.filter((e) => !org || e.scope === 'global' || e.project_id === org.id),
    [entries, org],
  )
  const autoCount = inOrg.filter((e) => e.source === 'auto').length

  const countsByAgent = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) if (e.agent_id) m.set(e.agent_id, (m.get(e.agent_id) ?? 0) + 1)
    return m
  }, [entries])

  const shown = useMemo(() => {
    const digits = search.replaceAll(/\D/g, '')
    const text = search.trim().toLowerCase()
    return inOrg.filter((e) => {
      if (tab === 'auto' && e.source !== 'auto') return false
      if (scope !== 'all' && e.scope !== scope) return false
      if (agentId && e.agent_id !== agentId) return false
      if (!text) return true
      if (digits && e.phone_e164.includes(digits)) return true
      return [e.reason, e.agent_name, e.project_name].some((v) => v?.toLowerCase().includes(text))
    })
  }, [inOrg, tab, scope, agentId, search])
  const agentFilterName = agentId ? entries.find((e) => e.agent_id === agentId)?.agent_name ?? 'This agent' : null

  const [removingId, setRemovingId] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: async (id: string) => {
      setRemovingId(id)
      const res = await fetch(`/api/dnc/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not remove the number')
    },
    onSettled: () => {
      setRemovingId(null)
      return queryClient.invalidateQueries({ queryKey: ['dnc-list'] })
    },
  })

  const filtersOn = scope !== 'all' || !!agentId || !!search.trim()
  const clearFilters = () => {
    setScope('all')
    setAgentId(null)
    setSearch('')
  }
  const pickOrg = (id: string | null) => {
    setOrgId(id)
    setAgentId(null)
    setOrgOpen(false)
  }

  const orgPicker = (
    <Popover open={orgOpen} onOpenChange={setOrgOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(V2_BTN, 'max-w-[220px]')}>
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{org?.name ?? 'All organizations'}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-64 p-0', V2_THEME)}>
        <Command>
          <CommandInput placeholder="Search organizations…" />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all" onSelect={() => pickOrg(null)}>
                <Check className={cn('mr-2 h-4 w-4', org ? 'opacity-0' : 'opacity-100')} />
                All organizations
              </CommandItem>
              {orgs.map((o) => (
                <CommandItem key={o.id} value={o.name} onSelect={() => pickOrg(o.id)}>
                  <Check className={cn('mr-2 h-4 w-4', org?.id === o.id ? 'opacity-100' : 'opacity-0')} />
                  {o.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )

  const renderNumbers = () => {
    if (error) {
      return (
        <div role="alert" className="m-4 rounded-xl border border-[var(--cl-red-line)] bg-[var(--cl-red-soft)] px-4 py-3 text-[13px] text-[var(--cl-red-text)]">
          Couldn&apos;t load the list: {(error as Error).message}
          <span className="mt-1 block text-[12px] opacity-80">
            If this is a fresh setup, run <code className="font-mono">migrations/add_dnc_checker.sql</code> on the database.
          </span>
        </div>
      )
    }
    if (isLoading) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--cl-text3)]" />
        </div>
      )
    }
    if (shown.length === 0) {
      const nothingYet = inOrg.length === 0
      return (
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <PhoneOff className="mb-3 h-6 w-6 text-[var(--cl-text3)]" />
          <p className="text-[14px] font-medium">{nothingYet ? 'No blocked numbers' : 'Nothing matches'}</p>
          <p className="mt-1 max-w-sm text-[13px] text-[var(--cl-text3)]">
            {nothingYet
              ? 'Numbers show up here when you add them, or when an agent hears a caller ask not to be called again.'
              : 'Try another search, or clear the filters.'}
          </p>
          {filtersOn && (
            <button type="button" onClick={clearFilters} className={cn(V2_BTN, 'mt-4')}>
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
      )
    }
    return <DncTable entries={shown} onRemove={(id) => remove.mutate(id)} removingId={removingId} />
  }

  return (
    <div className={cn('text-[var(--cl-text)]', V2_THEME)}>
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-8">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-baseline gap-2 text-[18px] font-semibold tracking-tight">
              Do Not Call
              {data && <span className="text-[14px] font-normal tabular-nums text-[var(--cl-text3)]">{data.total.toLocaleString()}</span>}
            </h2>
            <p className="mt-1 text-[13.5px] text-[var(--cl-text3)]">
              Numbers here are never dialed: not by campaigns, single calls, callbacks or retries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--cl-text)] px-3.5 text-[13.5px] font-medium text-[var(--cl-bg)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add numbers
          </button>
        </header>

        <div role="tablist" aria-label="Do Not Call" className="mt-5 flex gap-6 border-b border-[var(--cl-border)]">
          <TabButton active={tab === 'numbers'} onClick={() => setTab('numbers')}>
            Numbers <Count n={inOrg.length} />
          </TabButton>
          <TabButton active={tab === 'auto'} onClick={() => setTab('auto')}>
            Added by checker <Count n={autoCount} />
          </TabButton>
          <TabButton active={tab === 'agents'} onClick={() => setTab('agents')}>
            Agents
          </TabButton>
        </div>

        {tab === 'agents' ? (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-[var(--cl-text3)]">
                Each agent&apos;s DNC checker adds callers who ask not to be called again. New agents have it on.
              </p>
              {orgPicker}
            </div>
            {org ? (
              <DncAgentsPanel
                projectId={org.id}
                countsByAgent={countsByAgent}
                onShowNumbers={(id) => {
                  setAgentId(id)
                  setTab('numbers')
                }}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--cl-border2)] px-4 py-10 text-center text-[13px] text-[var(--cl-text3)]">
                Choose an organization to see its agents.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <label className="flex h-8 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel)] px-2.5 text-[var(--cl-text3)] focus-within:border-[var(--cl-accent-line)]">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search number, agent or reason"
                  aria-label="Search"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--cl-text)] outline-none placeholder:text-[var(--cl-text3)]"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="hover:text-[var(--cl-text)]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>
              {orgPicker}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={cn(V2_BTN, scope !== 'all' && 'border-[var(--cl-accent-line)] text-[var(--cl-accent-text)]')}>
                    {SCOPE_LABEL[scope]}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={cn('w-48', V2_THEME)}>
                  <DropdownMenuRadioGroup value={scope} onValueChange={(v) => setScope(v as ScopeFilter)}>
                    {(Object.keys(SCOPE_LABEL) as ScopeFilter[]).map((s) => (
                      <DropdownMenuRadioItem key={s} value={s} className="text-[13px]">
                        {s === 'all' ? 'Any' : SCOPE_LABEL[s]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {agentFilterName && (
              <div className="mt-3 flex items-center gap-2 text-[12.5px] text-[var(--cl-text3)]">
                Showing{' '}
                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--cl-border)] bg-[var(--cl-panel)] py-0.5 pl-2 pr-1 text-[var(--cl-text)]">
                  {agentFilterName}
                  <button type="button" onClick={() => setAgentId(null)} aria-label="Show every agent" className="rounded p-0.5 hover:bg-[var(--cl-hover)]">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}

            <section className="mt-3 overflow-hidden rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-panel)]">
              {renderNumbers()}
              {remove.isError && (
                <p role="alert" className="border-t border-[var(--cl-border)] px-4 py-2 text-[12.5px] text-[var(--cl-red-text)]">
                  {(remove.error as Error).message}
                </p>
              )}
            </section>
            {data && data.total > data.entries.length && (
              <p className="mt-2 text-[12px] text-[var(--cl-text3)]">
                Showing the newest {data.entries.length.toLocaleString()} of {data.total.toLocaleString()}.
              </p>
            )}
          </>
        )}
      </div>

      <DncAddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projects={orgs}
        defaultProjectId={org?.id ?? currentProjectId ?? null}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ['dnc-list'] })}
      />
    </div>
  )
}
