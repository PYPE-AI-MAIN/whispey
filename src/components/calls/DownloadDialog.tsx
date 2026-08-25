"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon, AlertTriangle, Download, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { downloadCSV, DownloadProgress } from '@/utils/callLogsUtils'
import type { FilterOperation } from '@/components/CallFilter'

const LARGE_EXPORT_THRESHOLD = 20_000

interface ColumnGroup {
  key: string
  label: string
}

interface DownloadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  projectId?: string
  activeFilters: FilterOperation[]
  basicColumns: ColumnGroup[]
  metadataColumns: string[]
  transcriptionColumns: string[]
  hiddenColumns: string[]
  initialDateRange?: { from: string; to: string }
}

export default function DownloadDialog({
  open, onOpenChange, agentId, projectId, activeFilters,
  basicColumns, metadataColumns, transcriptionColumns, hiddenColumns, initialDateRange,
}: DownloadDialogProps) {
  const allowedBasic = useMemo(
    () => basicColumns.filter(c => !hiddenColumns.includes(c.key)),
    [basicColumns, hiddenColumns]
  )
  const allowedMetadata = useMemo(
    () => metadataColumns.filter(c => !hiddenColumns.includes(c)),
    [metadataColumns, hiddenColumns]
  )
  const allowedTranscription = useMemo(
    () => transcriptionColumns.filter(c => !hiddenColumns.includes(c)),
    [transcriptionColumns, hiddenColumns]
  )
  const transcriptAllowed = !hiddenColumns.includes('transcript_json')

  const storageKey = `whispey:download-columns:${agentId}`

  const readExcludedColumns = (): Set<string> => {
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      return new Set(Array.isArray(parsed) ? parsed : [])
    } catch {
      return new Set()
    }
  }

  const [from, setFrom] = useState<Date | undefined>(initialDateRange?.from ? new Date(initialDateRange.from) : undefined)
  const [to, setTo] = useState<Date | undefined>(initialDateRange?.to ? new Date(initialDateRange.to) : undefined)
  const [timezone, setTimezone] = useState<'IST' | 'UTC'>('IST')
  const [selectedBasic, setSelectedBasic] = useState<string[]>(allowedBasic.map(c => c.key))
  const [selectedMetadata, setSelectedMetadata] = useState<string[]>(allowedMetadata)
  const [selectedTranscription, setSelectedTranscription] = useState<string[]>(allowedTranscription)
  const [includeTranscript, setIncludeTranscript] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // The stored preference is an exclusion set (unchecked columns) so newly
    // added columns default to included automatically. The disallowed set
    // always wins — never re-show a column the backend would strip anyway.
    const excluded = readExcludedColumns()
    setSelectedBasic(allowedBasic.map(c => c.key).filter(k => !excluded.has(k)))
    setSelectedMetadata(allowedMetadata.filter(k => !excluded.has(`metadata_${k}`)))
    setSelectedTranscription(allowedTranscription.filter(k => !excluded.has(`transcription_${k}`)))
    setIncludeTranscript(transcriptAllowed && !excluded.has('transcript'))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allowedBasic, allowedMetadata, allowedTranscription, transcriptAllowed])

  const persistExcludedColumns = () => {
    const excluded = [
      ...allowedBasic.map(c => c.key).filter(k => !selectedBasic.includes(k)),
      ...allowedMetadata.filter(k => !selectedMetadata.includes(k)).map(k => `metadata_${k}`),
      ...allowedTranscription.filter(k => !selectedTranscription.includes(k)).map(k => `transcription_${k}`),
      ...(transcriptAllowed && !includeTranscript ? ['transcript'] : []),
    ]
    try {
      localStorage.setItem(storageKey, JSON.stringify(excluded))
    } catch { /* localStorage unavailable — persistence is a nice-to-have */ }
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCountLoading(true)
    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}/call-logs/count`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_pre_distinct_filters: [{ column: 'agent_id', operator: 'eq', value: agentId }],
            p_post_distinct_filters: [],
            p_date_from: from ? format(from, 'yyyy-MM-dd') : null,
            p_date_to: to ? format(to, 'yyyy-MM-dd') : null,
          }),
        })
        const json = await res.json()
        if (!cancelled) setCount(res.ok ? json.count ?? 0 : null)
      } catch {
        if (!cancelled) setCount(null)
      } finally {
        if (!cancelled) setCountLoading(false)
      }
    }
    fetchCount()
    return () => { cancelled = true }
  }, [open, agentId, from, to])

  const toggle = (list: string[], setList: (v: string[]) => void, col: string) => {
    setList(list.includes(col) ? list.filter(c => c !== col) : [...list, col])
  }

  const handleDownload = async () => {
    setError(null)
    persistExcludedColumns()
    setProgress({ fetched: 0, total: count, phase: 'fetching' })
    try {
      await downloadCSV(
        agentId,
        activeFilters,
        { basic: selectedBasic, metadata: selectedMetadata, transcription_metrics: selectedTranscription, transcript: includeTranscript },
        projectId,
        setProgress,
        from || to ? { from: from ? format(from, 'yyyy-MM-dd') : '', to: to ? format(to, 'yyyy-MM-dd') : '' } : undefined,
        timezone
      )
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setProgress(null)
    }
  }

  const isLarge = count !== null && count > LARGE_EXPORT_THRESHOLD

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Download call logs</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date range */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Date range</label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 flex-1 justify-start">
                    <CalendarIcon className="h-3 w-3 opacity-60" />
                    {from ? format(from, 'MMM dd, yyyy') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={from} onSelect={setFrom} initialFocus />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-gray-500 dark:text-gray-400">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 flex-1 justify-start">
                    <CalendarIcon className="h-3 w-3 opacity-60" />
                    {to ? format(to, 'MMM dd, yyyy') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={to} onSelect={setTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Timestamp timezone</label>
            <Select value={timezone} onValueChange={(v: 'IST' | 'UTC') => setTimezone(v)}>
              <SelectTrigger className="h-8 text-xs w-40 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IST">IST (default)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row count estimate */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Estimated rows</span>
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
              {countLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : count !== null ? count.toLocaleString() : '—'}
            </span>
          </div>
          {isLarge && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-400/10 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Large export — this may take a while or fail in-browser. Consider narrowing the date range.
              </p>
            </div>
          )}

          {/* Columns */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Columns</label>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 max-h-48 overflow-y-auto p-2 space-y-1">
              {allowedBasic.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer px-1 py-0.5">
                  <Checkbox checked={selectedBasic.includes(col.key)} onCheckedChange={() => toggle(selectedBasic, setSelectedBasic, col.key)} />
                  {col.label}
                </label>
              ))}
              {allowedMetadata.map(col => (
                <label key={`meta-${col}`} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer px-1 py-0.5">
                  <Checkbox checked={selectedMetadata.includes(col)} onCheckedChange={() => toggle(selectedMetadata, setSelectedMetadata, col)} />
                  metadata_{col}
                </label>
              ))}
              {allowedTranscription.map(col => (
                <label key={`trans-${col}`} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer px-1 py-0.5">
                  <Checkbox checked={selectedTranscription.includes(col)} onCheckedChange={() => toggle(selectedTranscription, setSelectedTranscription, col)} />
                  transcription_{col}
                </label>
              ))}
              {transcriptAllowed && (
                <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer px-1 py-0.5">
                  <Checkbox checked={includeTranscript} onCheckedChange={() => setIncludeTranscript(v => !v)} />
                  Transcript
                </label>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <Button
            onClick={handleDownload}
            disabled={!!progress || (selectedBasic.length === 0 && selectedMetadata.length === 0 && selectedTranscription.length === 0 && !includeTranscript)}
            className="w-full gap-1.5"
          >
            {progress ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                {progress.phase === 'processing' ? 'Processing…' : `${progress.fetched.toLocaleString()} rows…`}
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
