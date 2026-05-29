'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Filter, X, ChevronDown, Calendar as CalendarIcon, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { isColumnVisibleForRole } from '@/utils/callLogsUtils'
import { cn } from '@/lib/utils'

// ── Public types ─────────────────────────────────────────────────────────────

export type FilterOperation =
  | {
      id: string
      type: 'filter'
      column: string
      operation: string
      value: string
      jsonField?: string
      order: number
    }
  | {
      id: string
      type: 'distinct'
      column: string
      jsonField?: string
      sortOrder?: 'asc' | 'desc'
      order: number
    }

export interface FilterRule {
  id: string
  column: string
  operation: string
  value: string
  jsonField?: string
  order: number
}

export interface DistinctConfig {
  column: string
  jsonField?: string
  order: 'asc' | 'desc'
}

interface CallFilterProps {
  onFiltersChange: (operations: FilterOperation[]) => void
  onClear: () => void
  availableMetadataFields?: string[]
  availableTranscriptionFields?: string[]
  initialFilters?: FilterOperation[]
  distinctConfig?: DistinctConfig
  onDistinctConfigChange?: (config: DistinctConfig | undefined) => void
  role?: string | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const FILTER_VALUE_TO_BASIC_KEY: Record<string, string> = {
  customer_number: 'customer_number',
  duration_seconds: 'duration_seconds',
  avg_latency: 'avg_latency',
  call_started_at: 'call_started_at',
  call_ended_reason: 'call_ended_reason',
  wcall_event: 'wcall_event',
  tags: 'tags',
  flag: 'flag',
}

const COLUMNS = [
  { value: 'customer_number',       label: 'Customer Number',  type: 'text'   },
  { value: 'duration_seconds',      label: 'Duration (s)',      type: 'number', numericType: 'integer' as const },
  { value: 'avg_latency',           label: 'Avg Latency (ms)',  type: 'number', numericType: 'float'   as const },
  { value: 'call_started_at',       label: 'Date',              type: 'date'   },
  { value: 'call_ended_reason',     label: 'Status',            type: 'text'   },
  { value: 'wcall_event',           label: 'Call Event',        type: 'text'   },
  { value: 'tags',                  label: 'Tags',              type: 'tags'   },
  { value: 'flag',                  label: 'Flag',              type: 'flag'   },
  { value: 'metadata',              label: 'Metadata',          type: 'jsonb'  },
  { value: 'transcription_metrics', label: 'Transcription',     type: 'jsonb'  },
]

const CALL_EVENT_OPTIONS = [
  { value: 'call_started', label: 'Started' },
  { value: 'call_ended',   label: 'Ended'   },
]

const OPERATIONS = {
  text:   [
    { value: 'equals',      label: 'Equals'      },
    { value: 'not_equals',  label: 'Not equals'  },
    { value: 'contains',    label: 'Contains'    },
    { value: 'starts_with', label: 'Starts with' },
  ],
  number: [
    { value: 'equals',       label: 'Equals'       },
    { value: 'not_equals',   label: 'Not equals'   },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than',    label: 'Less than'    },
  ],
  date:   [
    { value: 'equals',       label: 'On date' },
    { value: 'greater_than', label: 'After'   },
    { value: 'less_than',    label: 'Before'  },
  ],
  tags:   [
    { value: 'contains', label: 'Contains tag' },
    { value: 'equals',   label: 'Exact match'  },
  ],
  flag:   [
    { value: 'contains', label: 'Contains text' },
    { value: 'exists',   label: 'Has any flag'  },
  ],
  jsonb:  [
    { value: 'json_equals',       label: 'Equals'       },
    { value: 'json_not_equals',   label: 'Not equals'   },
    { value: 'json_contains',     label: 'Contains'     },
    { value: 'json_exists',       label: 'Field exists' },
    { value: 'json_greater_than', label: 'Greater than' },
    { value: 'json_less_than',    label: 'Less than'    },
  ],
}

const TEXT_NOT_EQUALS_COLUMNS = new Set(['customer_number', 'call_ended_reason'])

// ── Internal row state ───────────────────────────────────────────────────────

interface RowState {
  id: string
  type: 'filter' | 'distinct'
  column: string
  operation: string
  value: string
  jsonField: string
  sortOrder: 'asc' | 'desc'
}

function operationToRow(op: FilterOperation): RowState {
  if (op.type === 'distinct') {
    return { id: op.id, type: 'distinct', column: op.column, operation: '', value: '', jsonField: op.jsonField || '', sortOrder: op.sortOrder || 'asc' }
  }
  return { id: op.id, type: 'filter', column: op.column, operation: op.operation, value: op.value, jsonField: op.jsonField || '', sortOrder: 'asc' }
}

function rowToOperation(row: RowState, order: number): FilterOperation | null {
  const isJsonb = row.column === 'metadata' || row.column === 'transcription_metrics'
  if (!row.column) return null
  if (row.type === 'distinct') {
    if (isJsonb && !row.jsonField) return null
    return { id: row.id, type: 'distinct', column: row.column, ...(row.jsonField && { jsonField: row.jsonField }), sortOrder: row.sortOrder, order }
  }
  if (!row.operation) return null
  const noValue = row.operation === 'json_exists' || row.operation === 'exists'
  if (!noValue && !row.value.trim()) return null
  if (isJsonb && !row.jsonField) return null
  return { id: row.id, type: 'filter', column: row.column, operation: row.operation, value: noValue ? 'true' : row.value.trim(), ...(row.jsonField && { jsonField: row.jsonField }), order }
}

function buildRows(filters: FilterOperation[], distinctConfig?: DistinctConfig): RowState[] {
  const rows: RowState[] = filters.map(operationToRow)
  if (distinctConfig && !filters.some(f => f.type === 'distinct')) {
    rows.push({ id: `distinct-${Date.now()}`, type: 'distinct', column: distinctConfig.column, operation: '', value: '', jsonField: distinctConfig.jsonField || '', sortOrder: distinctConfig.order })
  }
  return rows
}

// ── Single filter row ────────────────────────────────────────────────────────

interface FilterRowProps {
  row: RowState
  onChange: (updated: RowState) => void
  onRemove: () => void
  availableMetadataFields: string[]
  availableTranscriptionFields: string[]
  columnsForRole: typeof COLUMNS
}

const FilterRow: React.FC<FilterRowProps> = ({
  row, onChange, onRemove, availableMetadataFields, availableTranscriptionFields, columnsForRole,
}) => {
  const isJsonb = row.column === 'metadata' || row.column === 'transcription_metrics'
  const columnDef = COLUMNS.find(c => c.value === row.column)
  const [calOpen, setCalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (row.column === 'call_started_at' && row.value) {
      try { return new Date(row.value) } catch { return undefined }
    }
    return undefined
  })

  const availableOps = useMemo(() => {
    if (!columnDef) return []
    const base = OPERATIONS[columnDef.type as keyof typeof OPERATIONS] ?? []
    if (columnDef.type === 'text' && !TEXT_NOT_EQUALS_COLUMNS.has(columnDef.value)) {
      return base.filter(o => o.value !== 'not_equals')
    }
    return base
  }, [columnDef])

  const jsonFields = row.column === 'metadata' ? availableMetadataFields : availableTranscriptionFields
  const getColLabel = (v: string) => columnsForRole.find(c => c.value === v)?.label ?? v
  const getOpLabel = (v: string) => {
    for (const ops of Object.values(OPERATIONS)) {
      const f = ops.find(o => o.value === v)
      if (f) return f.label
    }
    return v
  }

  const handleColChange = (col: string) => {
    onChange({ ...row, column: col, operation: '', value: '', jsonField: '' })
    setSelectedDate(undefined)
  }

  const noValue = row.operation === 'json_exists' || row.operation === 'exists'

  return (
    <div className="flex items-center gap-1.5">
      {/* type badge */}
      <button
        type="button"
        title={row.type === 'filter' ? 'Switch to Unique' : 'Switch to Filter'}
        onClick={() => onChange({ ...row, type: row.type === 'filter' ? 'distinct' : 'filter', operation: '', value: '' })}
        className={cn(
          'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border select-none transition-colors',
          row.type === 'distinct'
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
            : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
        )}
      >
        {row.type === 'filter' ? 'where' : 'unique'}
      </button>

      {/* Column */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 min-w-[110px] justify-between">
            <span className="truncate">{row.column ? getColLabel(row.column) : 'Column'}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {columnsForRole.map(col => (
            <DropdownMenuItem key={col.value} className="text-xs" onClick={() => handleColChange(col.value)}>
              {col.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* JSON field */}
      {isJsonb && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 min-w-[90px] justify-between" disabled={!row.column}>
              <span className="truncate">{row.jsonField || 'Field'}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 max-h-52 overflow-y-auto">
            {jsonFields.map(f => (
              <DropdownMenuItem key={f} className="text-xs" onClick={() => onChange({ ...row, jsonField: f, operation: '', value: '' })}>
                {f}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {row.type === 'filter' ? (
        <>
          {/* Operator */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline" size="sm"
                className="h-7 text-xs gap-1 min-w-[90px] justify-between"
                disabled={!row.column || (isJsonb && !row.jsonField)}
              >
                <span className="truncate">{row.operation ? getOpLabel(row.operation) : 'is…'}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {availableOps.map(op => (
                <DropdownMenuItem key={op.value} className="text-xs"
                  onClick={() => onChange({ ...row, operation: op.value, value: op.value === 'json_exists' || op.value === 'exists' ? 'true' : row.value })}
                >
                  {op.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Value */}
          {!noValue && (
            row.column === 'call_started_at' ? (
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                    {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Pick date'}
                    <CalendarIcon className="h-3 w-3 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom">
                  <Calendar mode="single" selected={selectedDate} onSelect={(d) => {
                    if (d) { setSelectedDate(d); onChange({ ...row, value: format(d, 'yyyy-MM-dd') }); setCalOpen(false) }
                  }} initialFocus />
                </PopoverContent>
              </Popover>
            ) : row.column === 'wcall_event' ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 min-w-[80px] justify-between" disabled={!row.operation}>
                    <span className="truncate">
                      {row.value ? CALL_EVENT_OPTIONS.find(o => o.value === row.value)?.label ?? row.value : 'Event'}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {CALL_EVENT_OPTIONS.map(opt => (
                    <DropdownMenuItem key={opt.value} className="text-xs" onClick={() => onChange({ ...row, value: opt.value })}>
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Input
                value={row.value}
                onChange={e => onChange({ ...row, value: e.target.value })}
                placeholder="Value…"
                title={row.value || undefined}
                className="h-7 text-xs w-28"
                disabled={!row.operation}
              />
            )
          )}
        </>
      ) : (
        /* Distinct: sort direction */
        <div className="flex gap-1">
          {(['asc', 'desc'] as const).map(dir => (
            <Button key={dir} type="button"
              variant={row.sortOrder === dir ? 'default' : 'outline'}
              size="sm" className="h-7 text-xs px-2.5"
              disabled={!row.column || (isJsonb && !row.jsonField)}
              onClick={() => onChange({ ...row, sortOrder: dir })}
            >
              {dir === 'asc' ? '↑ Asc' : '↓ Desc'}
            </Button>
          ))}
        </div>
      )}

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-0.5 rounded"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

const CallFilter: React.FC<CallFilterProps> = ({
  onFiltersChange,
  onClear,
  availableMetadataFields = [],
  availableTranscriptionFields = [],
  initialFilters = [],
  distinctConfig,
  onDistinctConfigChange,
  role = null,
}) => {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<RowState[]>(() => buildRows(initialFilters, distinctConfig))

  useEffect(() => {
    if (!open) setRows(buildRows(initialFilters, distinctConfig))
  }, [open, initialFilters, distinctConfig])

  const columnsForRole = useMemo(() => {
    if (role == null) return COLUMNS
    return COLUMNS.filter(c => {
      const key = FILTER_VALUE_TO_BASIC_KEY[c.value]
      return key === undefined || isColumnVisibleForRole(key, role)
    })
  }, [role])

  const completeOps = useMemo(
    () => rows.map((r, i) => rowToOperation(r, i)).filter(Boolean) as FilterOperation[],
    [rows]
  )

  const handleRowChange = useCallback((id: string, updated: RowState) => {
    setRows(prev => prev.map(r => r.id === id ? updated : r))
  }, [])

  const handleRemoveRow = useCallback((id: string) => {
    const next = rows.filter(r => r.id !== id)
    const ops = next.map((r, i) => rowToOperation(r, i)).filter(Boolean) as FilterOperation[]
    setRows(next)
    onFiltersChange(ops)
  }, [rows, onFiltersChange])

  const handleAddRow = useCallback(() => {
    setRows(prev => [
      ...prev,
      { id: `filter-${Date.now()}`, type: 'filter', column: '', operation: '', value: '', jsonField: '', sortOrder: 'asc' },
    ])
  }, [])

  const handleApply = useCallback(() => {
    onFiltersChange(completeOps)
    setOpen(false)
  }, [completeOps, onFiltersChange])

  const handleClearAll = useCallback(() => {
    setRows([])
    onClear()
    setOpen(false)
  }, [onClear])

  const activeCount = initialFilters.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={activeCount > 0 ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-2"
        >
          <Filter className="h-3 w-3" />
          Filter
          {activeCount > 0 && (
            <span className="h-4 min-w-[16px] rounded-full bg-white/20 text-[10px] font-semibold px-1 flex items-center justify-center">
              {activeCount}
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-180')} />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto min-w-[460px] max-w-[95vw] p-0 shadow-lg" align="start" sideOffset={6}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Filters</span>
          {rows.length > 0 && (
            <button type="button" onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Filter rows */}
        <div className="p-3 space-y-2 max-h-[50vh] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No filters applied</p>
          ) : (
            rows.map(row => (
              <FilterRow
                key={row.id}
                row={row}
                onChange={updated => handleRowChange(row.id, updated)}
                onRemove={() => handleRemoveRow(row.id)}
                availableMetadataFields={availableMetadataFields}
                availableTranscriptionFields={availableTranscriptionFields}
                columnsForRole={columnsForRole}
              />
            ))
          )}
          <button type="button" onClick={handleAddRow}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add filter
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/30">
          <span className="text-xs text-muted-foreground">
            {completeOps.length > 0
              ? `${completeOps.length} filter${completeOps.length !== 1 ? 's' : ''} ready`
              : rows.length > 0 ? 'Complete the filters above' : 'Add a filter to get started'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleApply} disabled={completeOps.length === 0}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default CallFilter
