/**
 * Choosing a field out of a hundred — Confluence "Analytics Phase 1 and 2 —
 * Build Spec" §10.8, and the half of §11.1 that says the catalog exists to help
 * people *find* fields.
 *
 * This agent produces 103 of them. They were in one flat dropdown, unsorted,
 * unsearchable and ungrouped, with five separate entries all reading "Reason"
 * and five reading "Score". So:
 *
 *  - **Search**, because scrolling a hundred rows is not finding.
 *  - **Groups**, because "what the platform recorded", "what the agent
 *    extracted", "quality metrics" and "whatever the dispatcher attached" are
 *    four different things and people know which one they want.
 *  - **The extractor's own words** under any field it declared, so the person
 *    picking `is_unassured_transfer` reads the definition their dispositions
 *    are actually computed from.
 *  - **Coverage on every row**, so a field filled in on 3% of calls is never
 *    picked by accident.
 *  - **Rescan**, because the extractor's keys are not a fixed list: a key the
 *    model only started emitting this morning is not in a catalog scanned
 *    before lunch, and the person looking for it has no other way to say
 *    "look again".
 */
'use client'
import React, { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown, RefreshCw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { GROUP_LABEL, GROUP_ORDER, type FieldGroup } from '@/server/analytics/extractor'
import type { CatalogField } from '@/types/analytics'

export const fieldKey = (f: { col: string; path?: string[] }) => `${f.col}::${(f.path ?? []).join('.')}`

/**
 * Two fields can share a label — `metrics.hi.reason` and
 * `metrics.is_task_complete.reason` are both "Reason" — and a picker showing
 * the same word five times is a picker you cannot use. Only the ambiguous ones
 * get qualified, so nothing else gets longer.
 */
export function disambiguate(fields: CatalogField[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const f of fields) counts.set(f.label, (counts.get(f.label) ?? 0) + 1)

  const out = new Map<string, string>()
  for (const f of fields) {
    const parent = f.path.length > 1 ? f.path.at(-2) ?? '' : ''
    const qualifier = parent.replaceAll(/[_.]+/g, ' ').trim()
    out.set(
      fieldKey(f),
      (counts.get(f.label) ?? 0) > 1 && qualifier ? `${f.label} (${qualifier})` : f.label
    )
  }
  return out
}

/** How often it is filled in, and a warning when that is not often. */
function Coverage({ pct }: Readonly<{ pct: number | null | undefined }>) {
  if (pct === null || pct === undefined) return null
  return (
    <span className={cn('shrink-0 text-[11px] tabular-nums', pct < 20 ? 'text-amber-600 dark:text-amber-500' : 'text-gray-400')}>
      {Math.round(pct)}%
    </span>
  )
}

export function FieldPicker({
  fields, value, onChange, disabled, placeholder = 'Pick a field', clearable, emptyLabel = 'None',
}: Readonly<{
  fields: CatalogField[]
  /** A `fieldKey`, or '' for nothing chosen. */
  value: string
  onChange: (key: string) => void
  disabled?: boolean
  placeholder?: string
  clearable?: boolean
  emptyLabel?: string
}>) {
  const [open, setOpen] = useState(false)
  const names = useMemo(() => disambiguate(fields), [fields])
  // the picker is only ever rendered on the agent page, so the agent is in the
  // URL — cheaper than threading a callback through four call sites
  const { agentid } = useParams<{ agentid?: string }>()
  const rescan = useRescan(agentid)

  const grouped = useMemo(() => {
    const byGroup = new Map<FieldGroup, CatalogField[]>()
    for (const f of fields) {
      const g = f.group ?? 'metadata'
      if (!byGroup.has(g)) byGroup.set(g, [])
      byGroup.get(g)!.push(f)
    }
    // inside a group, the fields people can actually use come first
    for (const list of byGroup.values()) {
      list.sort((a, b) => (b.coverage_pct ?? 0) - (a.coverage_pct ?? 0) || a.label.localeCompare(b.label))
    }
    return GROUP_ORDER.filter((g) => byGroup.get(g)?.length).map((g) => ({ group: g, fields: byGroup.get(g)! }))
  }, [fields])

  const chosen = fields.find((f) => fieldKey(f) === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-transparent px-2 text-sm outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-800"
        >
          <span className={cn('truncate', !chosen && 'text-gray-400')}>
            {chosen ? names.get(value) : placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <Coverage pct={chosen?.coverage_pct} />
            <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="w-[22rem] p-0">
        <Command
          // search the field's own name and the words its group is called, so
          // "extracted" finds the extracted ones
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <div className="flex items-center border-b border-gray-200 px-2 dark:border-gray-800">
            <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <CommandInput placeholder="Search fields…" className="h-9 border-0 text-sm focus:ring-0" />
          </div>
          <CommandList className="max-h-80">
            <CommandEmpty className="py-6 text-center text-xs text-gray-500">No field matches that.</CommandEmpty>

            {clearable && (
              <CommandGroup>
                <CommandItem
                  value={emptyLabel}
                  onSelect={() => {
                    onChange('')
                    setOpen(false)
                  }}
                >
                  <Check className={cn('mr-2 h-3.5 w-3.5', value ? 'opacity-0' : 'opacity-100')} />
                  <span className="text-gray-500">{emptyLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}

            {grouped.map(({ group, fields: list }) => (
              <CommandGroup key={group} heading={GROUP_LABEL[group]}>
                {list.map((f) => {
                  const key = fieldKey(f)
                  const name = names.get(key) ?? f.label
                  return (
                    <CommandItem
                      key={key}
                      // cmdk matches on this string, so the searchable text and
                      // the rendered row are deliberately not the same thing
                      value={`${name} ${f.path.join(' ')} ${f.col} ${GROUP_LABEL[group]}`}
                      onSelect={() => {
                        onChange(key)
                        setOpen(false)
                      }}
                      className="items-start gap-2"
                    >
                      <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', value === key ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{name}</span>
                          <Coverage pct={f.coverage_pct} />
                        </span>
                        {/* the definition the numbers are actually computed from */}
                        {f.description && (
                          <span className="line-clamp-2 text-[11px] leading-snug text-gray-400">{f.description}</span>
                        )}
                        <FieldShape field={f} />
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>

          {agentid && (
            <button
              type="button"
              onClick={rescan.run}
              disabled={rescan.busy}
              className="flex w-full items-center gap-1.5 border-t border-gray-100 px-3 py-2 text-left text-[11px] text-gray-500 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800/60"
            >
              <RefreshCw className={cn('h-3 w-3', rescan.busy && 'animate-spin')} />
              {rescan.busy ? 'Looking at the latest calls…' : 'Field missing? Rescan this agent'}
            </button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * What the field holds, in the values it actually holds.
 *
 * "yes / no" on a field whose call log says `1` and `0` is how somebody ends up
 * mistrusting the whole dashboard, so a true/false field says which pair it is
 * written with.
 */
export function FieldShape({ field }: Readonly<{ field: CatalogField }>) {
  if (field.value_type === 'boolean') {
    const BOOLEAN_PAIR_LABEL: Record<string, string> = {
      one_zero: 'yes (1) / no (0)',
      y_n: 'yes (Y) / no (N)',
      yes_no: 'yes / no',
    }
    const pair = BOOLEAN_PAIR_LABEL[field.boolean_encoding ?? ''] ?? 'yes (true) / no (false)'
    return <span className="text-[11px] text-gray-400">{pair}</span>
  }
  if (field.value_type === 'enum' && field.enum_values?.length) {
    const shown = field.enum_values.slice(0, 4).join(', ')
    const more = field.enum_values.length - 4
    return (
      <span className="truncate text-[11px] text-gray-400">
        {shown}
        {more > 0 ? ` +${more}` : ''}
      </span>
    )
  }
  return null
}

/**
 * Re-reads the agent's fields from its most recent calls. Extractor keys are
 * dynamic — the model emits what it found — so a field can appear days after
 * the catalog was built, and the six-hour cache would otherwise hide it.
 */
function useRescan(agentId?: string) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!agentId || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/analytics/fields?agentId=${agentId}&refresh=1`)
      if (res.ok) queryClient.setQueryData(['analytics', 'fields', agentId], await res.json())
    } catch (err) {
      // a failed rescan leaves the catalog exactly as it was, which is usable
      console.error('[analytics] rescan failed', err)
    } finally {
      setBusy(false)
    }
  }

  return { run, busy }
}
