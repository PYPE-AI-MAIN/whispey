'use client'

import { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Bot, Building2, Check, ChevronsUpDown, FileSpreadsheet, Globe, Keyboard, Loader2, Plus, Upload, X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { V2_BTN, V2_THEME } from '@/components/calls/v2/theme'
import {
  COUNTRIES, extractCsvPhones, findPhoneHeader, formatPhone, parseTypedNumbers,
  type AgentOption, type DncScope, type ProjectOption,
} from './dncShared'

const SCOPE_OPTIONS: { value: DncScope; label: string; hint: string; icon: typeof Globe }[] = [
  { value: 'agent', label: 'One agent', hint: 'Only this agent never calls it', icon: Bot },
  { value: 'project', label: 'Organization', hint: 'No agent in the organization calls it', icon: Building2 },
  { value: 'global', label: 'Everyone', hint: 'No agent anywhere calls it', icon: Globe },
]

const FIELD_LABEL = 'mb-1.5 block text-[12.5px] font-medium text-[var(--cl-text2)]'
const INPUT =
  'w-full rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] px-3 text-[13.5px] text-[var(--cl-text)] outline-none transition-colors placeholder:text-[var(--cl-text3)] focus:border-[var(--cl-accent-line)] focus:ring-2 focus:ring-[var(--cl-accent-soft)]'

interface AddResult {
  added: number
  skipped_duplicates: number
  invalid: string[]
}

export function DncAddDialog({
  open,
  onOpenChange,
  projects,
  defaultProjectId,
  onAdded,
}: Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ProjectOption[]
  defaultProjectId: string | null
  onAdded: () => void
}>) {
  const [scope, setScope] = useState<DncScope>('agent')
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId)
  const [agentId, setAgentId] = useState<string>('')
  const [orgOpen, setOrgOpen] = useState(false)
  const [countryCode, setCountryCode] = useState('IN')
  const [mode, setMode] = useState<'type' | 'csv'>('type')
  const [typed, setTyped] = useState('')
  const [csvNumbers, setCsvNumbers] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [result, setResult] = useState<AddResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0]
  const project = projects.find((p) => p.id === projectId) ?? null

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['dnc-agents', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/dnc/agents?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to load agents')
      return (await res.json()) as { agents: AgentOption[] }
    },
    enabled: open && scope === 'agent' && !!projectId,
    staleTime: 30_000,
  })
  const agents = agentsData?.agents ?? []

  const numbers = useMemo(
    () => (mode === 'csv' ? csvNumbers : parseTypedNumbers(typed, country.dial)),
    [mode, csvNumbers, typed, country.dial],
  )

  const clearCsv = () => {
    setCsvNumbers([])
    setCsvFileName(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const readCsv = (file: File) => {
    setCsvError(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const key = findPhoneHeader(parsed.meta.fields)
        if (!key) {
          clearCsv()
          setCsvError('No "phone" column. Add a header row with a column named phone.')
          return
        }
        const phones = extractCsvPhones(parsed.data, key, country.dial)
        if (phones.length === 0) {
          clearCsv()
          setCsvError('The phone column had no valid numbers.')
          return
        }
        setCsvNumbers(phones)
        setCsvFileName(file.name)
      },
      error: () => setCsvError('Could not read that file.'),
    })
  }

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/dnc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbers,
          scope,
          project_id: scope === 'project' ? projectId : undefined,
          agent_id: scope === 'agent' ? agentId : undefined,
          reason: reason.trim() || undefined,
          source: mode === 'csv' ? 'csv' : 'manual',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not add the numbers')
      return json as AddResult
    },
    onSuccess: (r) => {
      setResult(r)
      setTyped('')
      clearCsv()
      setReason('')
      onAdded()
    },
  })

  let missing: string | null = null
  if (scope !== 'global' && !projectId) missing = 'Choose an organization'
  else if (scope === 'agent' && !agentId) missing = 'Choose an agent'
  else if (numbers.length === 0) missing = mode === 'csv' ? 'Upload a CSV with a phone column' : 'Type at least one number'

  const close = (next: boolean) => {
    if (!next) {
      setResult(null)
      add.reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className={cn(
          'gap-0 overflow-hidden rounded-2xl border-[var(--cl-border)] bg-[var(--cl-panel)] p-0 text-[var(--cl-text)]',
          V2_THEME,
        )}
      >
        <div className="border-b border-[var(--cl-border)] px-6 pb-4 pt-5">
          <DialogTitle className="text-[17px] font-semibold tracking-tight">Add to the Do Not Call list</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-[var(--cl-text3)]">
            Listed numbers are never dialed: not from campaigns, single calls, Call Again, callbacks or retries.
          </DialogDescription>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* Who it's blocked for */}
          <fieldset>
            <legend className={FIELD_LABEL}>Block for</legend>
            <div className="flex rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] p-0.5">
              {SCOPE_OPTIONS.map((o) => {
                const on = scope === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setScope(o.value)}
                    className={cn(
                      'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors',
                      on ? 'bg-[var(--cl-panel)] text-[var(--cl-text)] shadow-sm' : 'text-[var(--cl-text3)] hover:text-[var(--cl-text)]',
                    )}
                  >
                    <o.icon className="h-3.5 w-3.5" />
                    {o.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--cl-text3)]">{SCOPE_OPTIONS.find((o) => o.value === scope)?.hint}.</p>
          </fieldset>

          {scope !== 'global' && (
            <div className="grid gap-3">
              <div>
                <span className={FIELD_LABEL}>Organization</span>
                <Popover open={orgOpen} onOpenChange={setOrgOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" className={cn(INPUT, 'flex h-9 items-center justify-between text-left')}>
                      <span className={cn('truncate', !project && 'text-[var(--cl-text3)]')}>{project?.name ?? 'Choose…'}</span>
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--cl-text3)]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className={cn('w-[--radix-popover-trigger-width] p-0', V2_THEME)} align="start">
                    <Command>
                      <CommandInput placeholder="Search organizations…" />
                      <CommandList>
                        <CommandEmpty>No organization found.</CommandEmpty>
                        <CommandGroup>
                          {projects.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                setProjectId(p.id)
                                setAgentId('')
                                setOrgOpen(false)
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', projectId === p.id ? 'opacity-100' : 'opacity-0')} />
                              {p.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {scope === 'agent' && (
                <div>
                  <span className={FIELD_LABEL}>Agent</span>
                  <Select value={agentId} onValueChange={setAgentId} disabled={!projectId || agentsLoading}>
                    <SelectTrigger className={cn(INPUT, 'h-9')}>
                      <SelectValue placeholder={agentsLoading ? 'Loading…' : 'Choose…'} />
                    </SelectTrigger>
                    <SelectContent className={V2_THEME}>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                      {agents.length === 0 && !agentsLoading && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No agents in this organization</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Numbers */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[var(--cl-text2)]">Numbers</span>
              <div className="flex items-center gap-1 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] p-0.5">
                {(['type', 'csv'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      'inline-flex h-6 items-center gap-1 rounded-md px-2 text-[12px] font-medium',
                      mode === m ? 'bg-[var(--cl-panel)] text-[var(--cl-text)] shadow-sm' : 'text-[var(--cl-text3)] hover:text-[var(--cl-text)]',
                    )}
                  >
                    {m === 'type' ? <Keyboard className="h-3 w-3" /> : <FileSpreadsheet className="h-3 w-3" />}
                    {m === 'type' ? 'Type' : 'CSV'}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'type' ? (
              <textarea
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                rows={3}
                placeholder={`${country.placeholder}\nOne per line, or separated by commas`}
                className={cn(INPUT, 'resize-y py-2 font-mono')}
              />
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) readCsv(f)
                  }}
                />
                {csvFileName ? (
                  <div className="flex items-center justify-between rounded-lg border border-[var(--cl-accent-line)] bg-[var(--cl-accent-soft)] px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 text-[13px]">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--cl-accent)]" />
                      <span className="truncate">{csvFileName}</span>
                    </span>
                    <button type="button" onClick={clearCsv} aria-label="Remove file" className="text-[var(--cl-text3)] hover:text-[var(--cl-text)]">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-[var(--cl-border2)] bg-[var(--cl-panel2)] px-4 py-6 transition-colors hover:border-[var(--cl-accent-line)] hover:bg-[var(--cl-hover)]"
                  >
                    <Upload className="h-5 w-5 text-[var(--cl-text3)]" />
                    <span className="text-[13px] font-medium">Choose a CSV file</span>
                    <span className="text-[12px] text-[var(--cl-text3)]">
                      Needs a column named <code className="font-mono text-[var(--cl-text)]">phone</code>
                    </span>
                  </button>
                )}
                {csvError && <p className="mt-1.5 text-[12px] text-[var(--cl-red-text)]">{csvError}</p>}
              </>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--cl-text3)]">
              <span>Numbers without a country code get</span>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="h-6 w-auto gap-1 rounded-md border-[var(--cl-border)] bg-[var(--cl-panel2)] px-1.5 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={V2_THEME}>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} <span className="font-mono">{c.prefix}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {numbers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {numbers.slice(0, 8).map((n) => (
                  <span key={n} className="rounded-md border border-[var(--cl-border)] bg-[var(--cl-panel2)] px-1.5 py-0.5 font-mono text-[11.5px] text-[var(--cl-text2)]">
                    {formatPhone(n)}
                  </span>
                ))}
                {numbers.length > 8 && <span className="px-1 py-0.5 text-[11.5px] text-[var(--cl-text3)]">+{numbers.length - 8} more</span>}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="dnc-reason" className={FIELD_LABEL}>Reason <span className="font-normal text-[var(--cl-text3)]">(optional)</span></label>
            <input id="dnc-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. asked by email to stop calls" className={cn(INPUT, 'h-9')} />
          </div>

          {result && (
            <div role="status" className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] px-3 py-2 text-[13px]">
              <span className="font-medium">{result.added} added</span>
              {result.skipped_duplicates > 0 && <span className="text-[var(--cl-text3)]"> · {result.skipped_duplicates} already listed</span>}
              {result.invalid.length > 0 && <span className="text-[var(--cl-red-text)]"> · {result.invalid.length} not valid</span>}
            </div>
          )}
          {add.isError && (
            <p role="alert" className="text-[13px] text-[var(--cl-red-text)]">{(add.error as Error).message}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--cl-border)] bg-[var(--cl-panel2)] px-6 py-3">
          <span className="text-[12.5px] text-[var(--cl-text3)]">
            {missing ?? `${numbers.length} number${numbers.length === 1 ? '' : 's'} ready`}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => close(false)} className={V2_BTN}>
              {result ? 'Done' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => add.mutate()}
              disabled={!!missing || add.isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--cl-text)] px-3 text-[13.5px] font-medium text-[var(--cl-bg)] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add to list
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
