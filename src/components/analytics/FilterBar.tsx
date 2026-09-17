/**
 * The filters above the canvas — Confluence "Analytics Phase 1 and 2 — Build
 * Spec" §10.3.
 *
 * A filter that is on but hidden makes every number on the page wrong without
 * anyone noticing, so active filters are chips you can see and remove, and the
 * editor is what you open to add one — never the other way round.
 *
 * They narrow every chart. A chart can narrow further on its own; it can never
 * widen past these.
 */
'use client'
import React, { useMemo, useState } from 'react'
import { Filter, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CatalogField } from '@/types/analytics'
import type { Condition, FilterNodeInput } from '@/server/analytics/spec'

/** Plain words. Nobody building a dashboard is thinking "not_in". */
const OPERATORS: { op: Condition['op']; label: string; needsValue: boolean; forType?: CatalogField['value_type'][] }[] = [
  { op: 'eq', label: 'is', needsValue: true },
  { op: 'neq', label: 'is not', needsValue: true },
  { op: 'contains', label: 'contains', needsValue: true, forType: ['text', 'enum'] },
  { op: 'gt', label: 'is more than', needsValue: true, forType: ['number'] },
  { op: 'lt', label: 'is less than', needsValue: true, forType: ['number'] },
  { op: 'is_true', label: 'is yes', needsValue: false, forType: ['boolean'] },
  { op: 'is_false', label: 'is no', needsValue: false, forType: ['boolean'] },
  { op: 'is_not_empty', label: 'has any value', needsValue: false },
  { op: 'is_empty', label: 'is blank', needsValue: false },
]

const keyOf = (f: { col: string; path?: string[] }) => `${f.col}::${(f.path ?? []).join('.')}`
const isCondition = (n: FilterNodeInput): n is Condition => !('children' in n)

export function FilterBar({
  filters, fields, onChange,
}: {
  filters: FilterNodeInput[]
  fields: CatalogField[]
  onChange: (filters: FilterNodeInput[]) => void
}) {
  const [open, setOpen] = useState(false)
  const labels = useMemo(() => new Map(fields.map((f) => [keyOf(f), f.label])), [fields])

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((node, i) =>
        isCondition(node) ? (
          <Chip
            key={i}
            label={describe(node, labels)}
            onRemove={() => onChange(filters.filter((_, j) => j !== i))}
          />
        ) : null
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-gray-500">
            {filters.length ? <Plus className="mr-1 h-3 w-3" /> : <Filter className="mr-1 h-3 w-3" />}
            Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <FilterEditor
            fields={fields}
            onAdd={(condition) => {
              onChange([...filters, condition])
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-xs items-center gap-1 rounded-full bg-blue-50 py-0.5 pl-2.5 pr-1 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
      <span className="truncate">{label}</span>
      <button onClick={onRemove} aria-label={`Remove filter ${label}`} className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function FilterEditor({ fields, onAdd }: { fields: CatalogField[]; onAdd: (c: Condition) => void }) {
  const usable = useMemo(() => fields.filter((f) => f.value_type !== 'json'), [fields])
  const [fieldKey, setFieldKey] = useState('')
  const [op, setOp] = useState<Condition['op']>('eq')
  const [value, setValue] = useState('')

  const field = usable.find((f) => keyOf(f) === fieldKey)
  const operators = OPERATORS.filter((o) => !o.forType || (field?.value_type && o.forType.includes(field.value_type)))
  const chosen = operators.find((o) => o.op === op) ?? operators[0]
  const values = field?.enum_values ?? []

  return (
    <div className="space-y-2">
      <Select
        value={fieldKey}
        onValueChange={(v) => {
          setFieldKey(v)
          const f = usable.find((x) => keyOf(x) === v)
          setOp(f?.value_type === 'boolean' ? 'is_true' : 'eq')
          setValue('')
        }}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Which field" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {usable.map((f) => (
            <SelectItem key={keyOf(f)} value={keyOf(f)}>
              <span className="flex w-full items-center justify-between gap-3">
                <span>{f.label}</span>
                {f.coverage_pct !== null && <span className="text-[11px] text-gray-400">{f.coverage_pct}%</span>}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {field && (
        <Select value={chosen?.op} onValueChange={(v) => setOp(v as Condition['op'])}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((o) => (
              <SelectItem key={o.op} value={o.op}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field && chosen?.needsValue && (
        values.length > 0 ? (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Which value" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {values.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Value"
            className="h-8 w-full rounded-md border border-gray-200 bg-transparent px-2 text-sm outline-none focus:border-blue-400 dark:border-gray-800"
          />
        )
      )}

      <Button
        size="sm"
        className="w-full"
        disabled={!field || (chosen?.needsValue && !value)}
        onClick={() =>
          field &&
          onAdd({
            field: { col: field.col, ...(field.path.length ? { path: field.path } : {}) },
            op: chosen.op,
            ...(chosen.needsValue ? { value } : {}),
          } as Condition)
        }
      >
        Add filter
      </Button>
    </div>
  )
}

/** "Disposition is confirmed" — readable at a glance, with no JSON path in it. */
function describe(c: Condition, labels: Map<string, string>): string {
  const name = labels.get(keyOf(c.field)) ?? c.field.path?.[c.field.path.length - 1] ?? c.field.col
  const op = OPERATORS.find((o) => o.op === c.op)
  const value = Array.isArray(c.value) ? c.value.join(', ') : c.value
  return `${name} ${op?.label ?? c.op}${op?.needsValue ? ` ${value}` : ''}`
}

/** Filter state lives in the URL, so a filtered view is a link somebody can send. */
export function encodeFilters(filters: FilterNodeInput[]): string {
  return filters.length ? encodeURIComponent(JSON.stringify(filters)) : ''
}

export function decodeFilters(raw: string | null): FilterNodeInput[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    // it came from a URL somebody could have edited; the API validates it
    // properly, this only stops the page crashing on nonsense
    return Array.isArray(parsed) ? (parsed as FilterNodeInput[]) : []
  } catch {
    return []
  }
}

export const isConditionNode = isCondition
