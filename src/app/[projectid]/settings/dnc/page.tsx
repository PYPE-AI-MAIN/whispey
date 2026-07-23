'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  ArrowLeft, Plus, Trash2, Loader2, ShieldBan, Search, ChevronsUpDown, Check, X, Globe, Building2,
  Keyboard, FileSpreadsheet, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ── Types & constants ──────────────────────────────────────────────────────
type Scope = 'global' | 'project'

interface DncEntry {
  id: string
  phone_e164: string
  phone_raw: string | null
  scope: Scope
  project_id: string | null
  reason: string | null
  source: string
  added_by: string
  created_at: string
}

interface ProjectOption {
  id: string
  name: string
}

const COUNTRIES = [
  { code: 'IN', name: 'India', prefix: '+91', dial: '91', flag: '🇮🇳', placeholder: '98765 43210' },
  { code: 'US', name: 'United States', prefix: '+1', dial: '1', flag: '🇺🇸', placeholder: '(555) 123-4567' },
]

/**
 * Normalize a number to E.164 using the selected country as the default region.
 * Mirrors the server normalizer (src/lib/dnc.ts) so what we preview matches what
 * gets stored. "Bare" = a national number with no country code; only those get
 * the dial code prepended. Numbers that already carry "+" or the country code
 * are left correct instead of being double-prefixed.
 */
function applyPrefix(raw: string, dialCode: string): string {
  const hadPlus = raw.trim().startsWith('+')
  let digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Already international: "+..." or "00..." → trust as-is.
  if (hadPlus) return digits.length >= 8 ? `+${digits}` : ''
  if (digits.startsWith('00')) { digits = digits.slice(2); return digits.length >= 8 ? `+${digits}` : '' }
  // National number with a trunk 0 (e.g. 09876543210) → strip it.
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '')
  // Already carries the country code (e.g. 919876543210) → don't prepend again.
  if (digits.startsWith(dialCode) && digits.length > 10) return `+${digits}`
  // Bare 10-digit national number → prepend the country code.
  if (digits.length === 10) return `+${dialCode}${digits}`
  // Anything else long enough: assume it already includes a country code.
  return digits.length >= 8 ? `+${digits}` : ''
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DncPage() {
  const { projectid: projectId } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isSuperAdmin, isLoading: roleLoading } = useGlobalRole()

  const [scope, setScope] = useState<Scope>('global')
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null)
  const [projectOpen, setProjectOpen] = useState(false)
  const [countryCode, setCountryCode] = useState('IN')
  const [mode, setMode] = useState<'manual' | 'csv'>('manual')
  const [numbersInput, setNumbersInput] = useState('')
  const [csvNumbers, setCsvNumbers] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [search, setSearch] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0]

  // Projects this superadmin can scope entries to.
  const { data: projectsData } = useQuery({
    queryKey: ['dnc-projects'],
    queryFn: async () => {
      const res = await fetch('/api/dnc/projects')
      if (!res.ok) throw new Error('Failed to load projects')
      return res.json() as Promise<{ projects: ProjectOption[] }>
    },
    enabled: isSuperAdmin,
    staleTime: 60_000,
  })
  const projects = projectsData?.projects ?? []

  // DNC entries for the active scope filter.
  const { data: listData, isLoading: listLoading, error: listError } = useQuery({
    queryKey: ['dnc-list', scope, scope === 'project' ? selectedProject?.id : null],
    queryFn: async () => {
      const params = new URLSearchParams({ scope })
      if (scope === 'project' && selectedProject) params.set('project_id', selectedProject.id)
      const res = await fetch(`/api/dnc/list?${params.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to load DNC list')
      return json as { entries: DncEntry[] }
    },
    enabled: isSuperAdmin && (scope === 'global' || !!selectedProject),
    retry: false,
  })
  const entries = listData?.entries ?? []

  const filteredEntries = useMemo(() => {
    const q = search.replace(/\D/g, '')
    if (!q) return entries
    return entries.filter((e) => e.phone_e164.includes(q))
  }, [entries, search])

  // Numbers to submit, from whichever tab is active (already prefixed for CSV).
  const activeNumbers = useMemo(() => {
    if (mode === 'csv') return csvNumbers
    const single = applyPrefix(numbersInput, country.dial)
    return single ? [single] : []
  }, [mode, csvNumbers, numbersInput, country.dial])

  // Parse a CSV, pull the `phone` column (case-insensitive), prefix + dedupe.
  const handleCsvFile = (file: File) => {
    setCsvError(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        const phoneKey = headers.find((h) => h.trim().toLowerCase() === 'phone')
        if (!phoneKey) {
          setCsvNumbers([])
          setCsvFileName(null)
          setCsvError('No "phone" column found. Add a header row with a column named "phone".')
          return
        }
        const seen = new Set<string>()
        for (const row of result.data) {
          const e164 = applyPrefix(String(row[phoneKey] ?? ''), country.dial)
          if (e164) seen.add(e164)
        }
        if (seen.size === 0) {
          setCsvNumbers([])
          setCsvFileName(null)
          setCsvError('The "phone" column had no valid numbers.')
          return
        }
        setCsvNumbers([...seen])
        setCsvFileName(file.name)
      },
      error: () => setCsvError('Could not read that file.'),
    })
  }

  const clearCsv = () => {
    setCsvNumbers([])
    setCsvFileName(null)
    setCsvError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async () => {
      const numbers = activeNumbers
      if (numbers.length === 0) throw new Error('Enter at least one number')
      const res = await fetch('/api/dnc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbers,
          scope,
          project_id: scope === 'project' ? selectedProject?.id : undefined,
          reason: reason.trim() || undefined,
          source: mode === 'csv' ? 'csv' : numbers.length > 1 ? 'csv' : 'manual',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to add')
      return json as { added: number; skipped_duplicates: number; invalid: string[] }
    },
    onSuccess: (r) => {
      setNumbersInput('')
      clearCsv()
      setReason('')
      const bits = [`${r.added} added`]
      if (r.skipped_duplicates) bits.push(`${r.skipped_duplicates} already listed`)
      if (r.invalid?.length) bits.push(`${r.invalid.length} invalid`)
      setFeedback(bits.join(' · '))
      queryClient.invalidateQueries({ queryKey: ['dnc-list'] })
    },
    onError: (e: Error) => setFeedback(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dnc/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dnc-list'] }),
  })

  // ── Guards ──────────────────────────────────────────────────────────────
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" />
      </div>
    )
  }
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldBan className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
          <p className="text-gray-900 dark:text-gray-100 mb-1">DNC management is restricted to superadmins.</p>
          <Button variant="link" onClick={() => router.back()}>Go back</Button>
        </div>
      </div>
    )
  }

  const needsProject = scope === 'project' && !selectedProject
  const parsedCount = activeNumbers.length
  const canSubmit = parsedCount > 0 && !needsProject && !addMutation.isPending

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="min-h-full bg-gray-50 dark:bg-gray-900">
        {/* Navbar */}
        <div className="border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/${projectId}/settings/phone-numbers`)}
              aria-label="Back"
              className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
              <ShieldBan className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">Do Not Call (DNC) List</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Listed numbers are never dialed — blocked at upload, single-call, and dispatch.</p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {/* Add card */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/50 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <Plus className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Add numbers</h2>
            </div>

            <div className="p-5 grid gap-4">
              {/* Scope + project */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Scope</label>
                  <Select value={scope} onValueChange={(v) => { setScope(v as Scope); setSelectedProject(null) }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">
                        <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Global — all projects</span>
                      </SelectItem>
                      <SelectItem value="project">
                        <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Per project</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scope === 'project' && (
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Project</label>
                    <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={projectOpen}
                          className="justify-between font-normal"
                        >
                          {selectedProject ? selectedProject.name : 'Select project…'}
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search project…" />
                          <CommandList>
                            <CommandEmpty>No project found.</CommandEmpty>
                            <CommandGroup>
                              {projects.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={p.name}
                                  onSelect={() => { setSelectedProject(p); setProjectOpen(false) }}
                                >
                                  <Check className={cn('mr-2 h-4 w-4', selectedProject?.id === p.id ? 'opacity-100' : 'opacity-0')} />
                                  {p.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {/* Numbers: manual entry or CSV upload */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Phone numbers</label>
                  {parsedCount > 0 && (
                    <Badge variant="secondary">{parsedCount} ready</Badge>
                  )}
                </div>

                <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'csv')}>
                  <TabsList className="grid w-full max-w-xs grid-cols-2">
                    <TabsTrigger value="manual"><Keyboard className="h-3.5 w-3.5 mr-1.5" /> Type</TabsTrigger>
                    <TabsTrigger value="csv"><FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> CSV</TabsTrigger>
                  </TabsList>

                  {/* Manual entry — joined country selector + input */}
                  <TabsContent value="manual" className="mt-3 space-y-1.5">
                    <div className="flex">
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-[104px] shrink-0 rounded-r-none border-r-0 bg-gray-50 dark:bg-gray-800 focus:ring-0 focus:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <span className="flex items-center gap-2">
                                <span className="text-base">{c.flag}</span>
                                <span className="font-mono text-xs font-semibold">{c.prefix}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={numbersInput}
                        onChange={(e) => setNumbersInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) addMutation.mutate() }}
                        placeholder={country.placeholder}
                        className="rounded-l-none font-mono focus-visible:ring-blue-500/30 focus-visible:border-blue-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {country.prefix} is applied to bare numbers · numbers starting with “+” are kept as-is
                    </p>
                  </TabsContent>

                  {/* CSV upload */}
                  <TabsContent value="csv" className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Bare numbers get</span>
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-[96px] h-8 bg-gray-50 dark:bg-gray-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <span className="flex items-center gap-2">
                                <span className="text-base">{c.flag}</span>
                                <span className="font-mono text-xs font-semibold">{c.prefix}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleCsvFile(f)
                      }}
                    />

                    {csvFileName ? (
                      <div className="flex items-center justify-between rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{csvFileName}</span>
                          <Badge variant="secondary" className="shrink-0">{csvNumbers.length} numbers</Badge>
                        </div>
                        <button onClick={clearCsv} aria-label="Remove file" className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors py-6 px-4"
                      >
                        <Upload className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Choose CSV file</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Must have a column named <code className="font-mono text-gray-700 dark:text-gray-300">phone</code> — one number per row
                        </span>
                      </button>
                    )}

                    {csvError && <p className="text-xs text-red-600 dark:text-red-400">{csvError}</p>}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Reason + submit */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="grid gap-1.5 flex-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Reason (optional)</label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer opt-out" />
                </div>
                <Button onClick={() => addMutation.mutate()} disabled={!canSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add to DNC
                </Button>
              </div>

              {needsProject && (
                <p className="text-xs text-amber-600 dark:text-amber-500">Select a project first.</p>
              )}
              {feedback && (
                <div className="flex items-center justify-between text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-gray-700 dark:text-gray-300">
                  <span>{feedback}</span>
                  <button onClick={() => setFeedback(null)} aria-label="Dismiss" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* List card */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/50 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                {scope === 'global' ? <Globe className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                <span>
                  {scope === 'global'
                    ? 'Global entries'
                    : selectedProject
                      ? `Entries for ${selectedProject.name}`
                      : 'Select a project to view its entries'}
                </span>
                {!listLoading && (scope === 'global' || selectedProject) && (
                  <Badge variant="secondary">{filteredEntries.length}</Badge>
                )}
              </div>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search number…"
                  className="pl-8 w-56"
                />
              </div>
            </div>

            {listError ? (
              <div className="m-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                Couldn’t load the DNC list: {(listError as Error).message}.
                <span className="block text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                  If this is the first run, make sure the <code className="font-mono">pype_voice_dnc_list</code> table exists in Supabase.
                </span>
              </div>
            ) : listLoading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-400" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                {scope === 'project' && !selectedProject ? 'Select a project above.' : 'No numbers on the DNC list.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Added by</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono font-medium text-gray-900 dark:text-gray-100">{e.phone_e164}</TableCell>
                      <TableCell className="text-gray-500 dark:text-gray-400">{e.reason || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{e.source}</Badge></TableCell>
                      <TableCell className="text-gray-500 dark:text-gray-400 max-w-[180px] truncate" title={e.added_by}>{e.added_by}</TableCell>
                      <TableCell className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(e.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => deleteMutation.mutate(e.id)}
                              disabled={deleteMutation.isPending}
                              aria-label="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove from DNC</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
