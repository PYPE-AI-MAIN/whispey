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
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CatalogField } from '@/types/analytics'
import { FieldPicker, FieldShape } from './FieldPicker'
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
}: Readonly<{
  filters: FilterNodeInput[]
  fields: CatalogField[]
  onChange: (filters: FilterNodeInput[]) => void
}>) {
  const [open, setOpen] = useState(false)
  const labels = useMemo(() => new Map(fields.map((f) => [keyOf(f), f.label])), [fields])

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((node, i) =>
        isCondition(node) ? (
          <Chip
            key={`${keyOf(node.field)}-${node.op}-${i}`}
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
        <PopoverContent align="start" collisionPadding={12} className="w-64 p-3">
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

export function Chip({ label, onRemove }: Readonly<{ label: string; onRemove: () => void }>) {
  return (
    <span className="inline-flex max-w-xs items-center gap-1 rounded-full bg-blue-50 py-0.5 pl-2.5 pr-1 text-xs text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
      <span className="truncate">{label}</span>
      <button onClick={onRemove} aria-label={`Remove filter ${label}`} className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

export function FilterEditor({ fields, onAdd }: Readonly<{ fields: CatalogField[]; onAdd: (c: Condition) => void }>) {
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
      <FieldPicker
        fields={usable}
        value={fieldKey}
        placeholder="Which field"
        onChange={(v) => {
          setFieldKey(v)
          const f = usable.find((x) => keyOf(x) === v)
          setOp(f?.value_type === 'boolean' ? 'is_true' : 'eq')
          setValue('')
        }}
      />

      {/* what the field holds, in the values it holds: "is yes" on a column
          full of 1 and 0 is how somebody stops trusting the dashboard */}
      {field && (
        <p className="px-0.5 text-[11px] leading-snug text-gray-400">
          {field.description ? `${field.description} ` : ''}
          <FieldShape field={field} />
        </p>
      )}

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
        className="h-8 w-full text-xs"
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
  // half these fields are already called "Is something", and "Is conversation
  // hindi is yes" is not a sentence anybody wrote on purpose
  if (c.op === 'is_true') return `${name}: yes`
  if (c.op === 'is_false') return `${name}: no`
  const op = OPERATORS.find((o) => o.op === c.op)
  const value = Array.isArray(c.value) ? c.value.join(', ') : c.value
  const valueSuffix = op?.needsValue ? ` ${value}` : ''
  return `${name} ${op?.label ?? c.op}${valueSuffix}`
}

/**
 * One chart's own filters, in its settings panel — Confluence §10.3.
 *
 * The dashboard chips above the canvas narrow everything; these narrow one
 * card. "Completed calls" is a count with a filter on it, and until this
 * existed that filter was neither visible nor changeable: the number was 110
 * and nothing on the screen said what made a call completed.
 */
export function ChartFilters({
  filters, fields, disabled, onChange,
}: Readonly<{
  filters: FilterNodeInput[]
  fields: CatalogField[]
  disabled: boolean
  onChange: (filters: FilterNodeInput[]) => void
}>) {
  const [open, setOpen] = useState(false)
  const labels = useMemo(() => new Map(fields.map((f) => [keyOf(f), f.label])), [fields])

  return (
    <div className="flex flex-wrap items-center gap-1">
      {filters.map((node, i) =>
        isCondition(node) ? (
          <Chip key={`${keyOf(node.field)}-${node.op}-${i}`} label={describe(node, labels)} onRemove={() => onChange(filters.filter((_, j) => j !== i))} />
        ) : (
          <Chip key={`group-${i}`} label="a group of conditions" onRemove={() => onChange(filters.filter((_, j) => j !== i))} /> // NOSONAR: a group node has no stable identity of its own (two "and" groups with the same children are indistinguishable) — index is the only available tiebreaker
        )
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" disabled={disabled} className="h-6 px-2 text-xs text-gray-500">
            <Plus className="mr-1 h-3 w-3" />
            {filters.length ? 'Add' : 'Only where…'}
          </Button>
        </PopoverTrigger>
        {/* the settings panel is 288px wide; open to its left rather than
            spilling off the edge of it */}
        <PopoverContent side="left" align="start" collisionPadding={12} className="w-64 p-3">
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
