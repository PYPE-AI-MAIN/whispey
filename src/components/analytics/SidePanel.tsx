/**
 * Chart types when nothing is selected, settings when something is — Confluence
 * "Analytics Phase 1 and 2 — Build Spec" §10.4, §10.8.
 *
 * A panel rather than a popup, because the chart updates live on the real
 * dashboard as you change it and a popup covers the thing you are judging.
 *
 * No database words anywhere. The field list shows "Task completed" and how
 * often it is filled in; it never shows transcription_metrics.is_task_complete.
 */
'use client'
import React, { useMemo } from 'react'
import { BarChart3, Hash, LineChart as LineIcon, PieChart as PieIcon, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CatalogField, ChartKind, Widget } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'

/** What a chart-type tile puts on the drag event, and what the grid reads off it. */
export const CHART_TYPE_DRAG_TYPE = 'application/x-whispey-chart-type'

const CHART_TYPES: { kind: ChartKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'kpi', label: 'Number', icon: <Hash className="h-4 w-4" /> },
  { kind: 'bar', label: 'Bar', icon: <BarChart3 className="h-4 w-4" /> },
  { kind: 'line', label: 'Line', icon: <LineIcon className="h-4 w-4" /> },
  { kind: 'table', label: 'Table', icon: <Table2 className="h-4 w-4" /> },
  { kind: 'pie', label: 'Pie', icon: <PieIcon className="h-4 w-4" /> },
]

/** Plain words for what each calculation does. Nobody is reading "p95" and thinking "percentile". */
const CALCULATIONS: { fn: NonNullable<SpecInput['agg']>['fn']; label: string; needs: 'none' | 'any' | 'number' | 'boolean' }[] = [
  { fn: 'count', label: 'How many calls', needs: 'none' },
  { fn: 'count_distinct', label: 'How many different', needs: 'any' },
  { fn: 'rate', label: 'Percentage that are yes', needs: 'boolean' },
  { fn: 'sum', label: 'Total of', needs: 'number' },
  { fn: 'avg', label: 'Average of', needs: 'number' },
  { fn: 'p50', label: 'Middle value of', needs: 'number' },
  { fn: 'p95', label: 'Slowest 5% of', needs: 'number' },
  { fn: 'min', label: 'Lowest', needs: 'number' },
  { fn: 'max', label: 'Highest', needs: 'number' },
]

const BUCKETS = [
  { value: 'none', label: 'No time breakdown' },
  { value: 'auto', label: 'Automatic' },
  { value: 'hour', label: 'By hour' },
  { value: 'day', label: 'By day' },
  { value: 'week', label: 'By week' },
  { value: 'month', label: 'By month' },
]

const fieldKey = (f: { col: string; path?: string[] }) => `${f.col}::${(f.path ?? []).join('.')}`

/** Common sizes, for people who would rather click than drag a corner. */
const WIDTH_PRESETS = [
  { label: 'Quarter', columns: 3 },
  { label: 'Third', columns: 4 },
  { label: 'Half', columns: 6 },
  { label: 'Full', columns: 12 },
]

/** True when two of the field's own values differ only in case or spacing. */
export function hasCaseVariants(values: string[] | null | undefined): boolean {
  if (!values?.length) return false
  const folded = new Set(values.map((v) => v.trim().toLowerCase()))
  return folded.size < values.length
}

const currentColumns = (widget: Widget): number | null =>
  'w' in (widget.layout ?? {}) ? (widget.layout as { w: number }).w : null

/**
 * Draggable onto the canvas, and clickable for anyone who would rather not drag
 * — a keyboard user, or somebody on a trackpad who finds dragging fiddly.
 * Dropping it places it where you let go; clicking it appends to the end.
 *
 * Plain HTML5 drag rather than a library, because the grid reads the drop
 * itself and only understands a real dragstart.
 */
function ChartTypeTile({
  type, disabled, onAdd, onDragStart, onDragEnd,
}: {
  type: { kind: ChartKind; label: string; icon: React.ReactNode }
  disabled: boolean
  onAdd: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <button
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData(CHART_TYPE_DRAG_TYPE, type.kind)
        // Firefox will not start a drag without text/plain
        e.dataTransfer.setData('text/plain', type.kind)
        e.dataTransfer.effectAllowed = 'copy'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      disabled={disabled}
      onClick={onAdd}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-4 text-xs text-gray-600 transition',
        'hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 active:cursor-grabbing',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-transparent',
        'dark:border-gray-800 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:bg-blue-950/30',
        !disabled && 'cursor-grab'
      )}
    >
      {type.icon}
      {type.label}
    </button>
  )
}

export function SidePanel({
  selected, fields, canEdit, onAddChart, onDragChartType, onChange, onChangeKind, onChangeWidth, onChangeTitle,
}: {
  selected: Widget | null
  fields: CatalogField[]
  canEdit: boolean
  onAddChart: (kind: ChartKind) => void
  /** Tells the canvas which type is in flight, so the drop placeholder is the right size. */
  onDragChartType: (kind: ChartKind | null) => void
  onChange: (spec: SpecInput) => void
  onChangeKind: (kind: ChartKind) => void
  /** Columns out of twelve. Dragging the corner does the same thing; this is the keyboard way. */
  onChangeWidth: (columns: number) => void
  onChangeTitle: (title: string) => void
}) {
  if (!selected) {
    return (
      <Panel title="Chart types">
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {canEdit
            ? 'Drag one onto the dashboard, or click to add it at the end.'
            : 'You can view this dashboard but not change it.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CHART_TYPES.map((t) => (
            <ChartTypeTile
              key={t.kind}
              type={t}
              disabled={!canEdit}
              onAdd={() => onAddChart(t.kind)}
              onDragStart={() => onDragChartType(t.kind)}
              onDragEnd={() => onDragChartType(null)}
            />
          ))}
        </div>
      </Panel>
    )
  }

  return (
    <ChartSettings
      widget={selected}
      fields={fields}
      canEdit={canEdit}
      onChange={onChange}
      onChangeKind={onChangeKind}
      onChangeWidth={onChangeWidth}
      onChangeTitle={onChangeTitle}
    />
  )
}

function ChartSettings({
  widget, fields, canEdit, onChange, onChangeKind, onChangeWidth, onChangeTitle,
}: {
  widget: Widget
  fields: CatalogField[]
  canEdit: boolean
  onChange: (spec: SpecInput) => void
  onChangeKind: (kind: ChartKind) => void
  onChangeWidth: (columns: number) => void
  onChangeTitle: (title: string) => void
}) {
  const spec = widget.spec
  const calculation = CALCULATIONS.find((c) => c.fn === spec.agg?.fn) ?? CALCULATIONS[0]

  const usable = useMemo(() => {
    if (calculation.needs === 'none') return []
    return fields.filter((f) => {
      if (calculation.needs === 'number') return f.value_type === 'number'
      if (calculation.needs === 'boolean') return f.value_type === 'boolean'
      return f.value_type !== 'json'
    })
  }, [fields, calculation.needs])

  const dimensions = useMemo(() => fields.filter((f) => f.is_dimension && f.value_type !== 'json'), [fields])
  const identities = useMemo(() => fields.filter((f) => f.is_identity_candidate), [fields])

  const setSpec = (patch: Partial<SpecInput>) => onChange({ ...spec, ...patch })

  const pickField = (key: string, onPicked: (f: CatalogField) => void) => {
    const f = fields.find((x) => fieldKey(x) === key)
    if (f) onPicked(f)
  }

  return (
    <Panel title="Chart settings">
      <Row label="Name">
        <input
          value={widget.title}
          disabled={!canEdit}
          onChange={(e) => onChangeTitle(e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-400 disabled:opacity-60 dark:border-gray-800"
        />
      </Row>

      <Row label="Shown as">
        <div className="flex flex-wrap gap-1">
          {CHART_TYPES.map((t) => (
            <button
              key={t.kind}
              disabled={!canEdit}
              onClick={() => onChangeKind(t.kind)}
              className={cn(
                'rounded-md border px-2 py-1 text-xs transition disabled:opacity-50',
                widget.kind === t.kind
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-800 dark:text-gray-400'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Calculation">
        <Picker
          value={spec.agg?.fn ?? 'count'}
          disabled={!canEdit}
          options={CALCULATIONS.map((c) => ({ value: c.fn, label: c.label }))}
          onChange={(fn) => {
            const next = CALCULATIONS.find((c) => c.fn === fn)!
            setSpec({
              agg:
                next.needs === 'none'
                  ? { fn: next.fn }
                  : { fn: next.fn, field: spec.agg?.field, ...(next.needs === 'boolean' ? { denominator: 'field_present' as const } : {}) },
            })
          }}
        />
      </Row>

      {calculation.needs !== 'none' && (
        <Row label="Of which field">
          <Picker
            value={spec.agg?.field ? fieldKey(spec.agg.field) : ''}
            disabled={!canEdit}
            placeholder={usable.length ? 'Pick a field' : 'No fields of this kind yet'}
            options={usable.map((f) => ({ value: fieldKey(f), label: f.label, hint: coverageHint(f) }))}
            onChange={(key) =>
              pickField(key, (f) =>
                setSpec({
                  agg: {
                    fn: calculation.fn,
                    field: {
                      col: f.col,
                      ...(f.path.length ? { path: f.path } : {}),
                      ...(f.boolean_encoding ? { boolean_encoding: f.boolean_encoding } : {}),
                    },
                    ...(calculation.needs === 'boolean' ? { denominator: 'field_present' as const } : {}),
                  },
                } as Partial<SpecInput>)
              )
            }
          />
        </Row>
      )}

      <Row label="Split by">
        <Picker
          value={spec.dimension?.field ? fieldKey(spec.dimension.field) : ''}
          disabled={!canEdit}
          placeholder="Nothing — one total"
          clearable
          options={dimensions.map((f) => ({ value: fieldKey(f), label: f.label, hint: coverageHint(f) }))}
          onChange={(key) =>
            key
              ? pickField(key, (f) =>
                  setSpec({
                    dimension: {
                      field: { col: f.col, ...(f.path.length ? { path: f.path } : {}) },
                      // yes/Yes/no/No is one answer written four ways, not four categories
                      case_insensitive: hasCaseVariants(f.enum_values),
                    },
                  })
                )
              : setSpec({ dimension: undefined })
          }
        />
      </Row>

      <Row label="Over time">
        <Picker
          value={spec.bucket ?? 'none'}
          disabled={!canEdit}
          options={BUCKETS}
          onChange={(bucket) => setSpec({ bucket: bucket as SpecInput['bucket'] })}
        />
      </Row>

      {/* the count control, again — it changes what the number means */}
      <Row label="Count">
        <Picker
          value={spec.grain === 'entity' ? fieldKey(spec.dedupe!.key.field) : 'interaction'}
          disabled={!canEdit || identities.length === 0}
          options={[
            { value: 'interaction', label: 'Every call' },
            ...identities.map((f) => ({ value: fieldKey(f), label: `One per ${f.label.toLowerCase()}` })),
          ]}
          onChange={(key) =>
            key === 'interaction'
              ? setSpec({ grain: 'interaction', dedupe: undefined })
              : pickField(key, (f) =>
                  setSpec({
                    grain: 'entity',
                    dedupe: {
                      key: { field: { col: f.col, ...(f.path.length ? { path: f.path } : {}) }, fallback: 'call_id' },
                      winner: 'best_outcome',
                      ranking_ref: 'agent',
                      lookback_days: 90,
                    },
                  })
                )
          }
        />
        {spec.grain === 'entity' && (
          <p className="mt-1 text-[11px] text-gray-400">
            Repeat calls collapse to one row, keeping the best outcome from the agent’s order.
          </p>
        )}
      </Row>

      <Row label="Width">
        <div className="flex gap-1">
          {WIDTH_PRESETS.map((p) => (
            <button
              key={p.label}
              disabled={!canEdit}
              onClick={() => onChangeWidth(p.columns)}
              className={cn(
                'flex-1 rounded-md border px-2 py-1 text-xs transition disabled:opacity-50',
                currentColumns(widget) === p.columns
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray-400">Or drag a card’s bottom-right corner to any size.</p>
      </Row>

    </Panel>
  )
}

/** Every field says how often it is actually filled in, so nobody charts a field that is 4% present. */
function coverageHint(f: CatalogField): string | undefined {
  if (f.coverage_pct === null || f.coverage_pct === undefined) return undefined
  return `${f.coverage_pct}% of calls`
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-l border-gray-200 bg-gray-50/60 px-4 py-4 dark:border-gray-800 dark:bg-gray-900/40">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h2>
      {children}
    </aside>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  )
}

function Picker({
  value, options, onChange, disabled, placeholder, clearable,
}: {
  value: string
  options: { value: string; label: string; hint?: string }[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  clearable?: boolean
}) {
  const NONE = '__none__'
  return (
    <Select
      value={value || NONE}
      disabled={disabled}
      onValueChange={(v) => onChange(v === NONE ? '' : v)}
    >
      <SelectTrigger className="h-8 w-full text-sm">
        <SelectValue placeholder={placeholder ?? 'Pick one'} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {(clearable || !value) && <SelectItem value={NONE}>{placeholder ?? 'None'}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex w-full items-center justify-between gap-3">
              <span>{o.label}</span>
              {o.hint && <span className="text-[11px] text-gray-400">{o.hint}</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
