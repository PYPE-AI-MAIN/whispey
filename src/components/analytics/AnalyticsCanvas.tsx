/**
 * The dashboard canvas — Confluence "Analytics Phase 1 and 2 — Build Spec" §10.
 *
 * This replaces the hand-coded Overview. Every tile and chart on it is now an
 * ordinary saved chart object: editable, duplicable, clickable through to the
 * calls, and exportable, instead of seven special cases in a 1,478-line file.
 *
 * One DndContext covers the panel and the grid, so the same gesture does both
 * things §10 asks for: drag a chart type out of the panel to place a new chart,
 * and drag a card to move it. dnd-kit gives no grid behaviour of its own, so the
 * placement rules are here — a 12-column CSS grid and a width per card, which is
 * what §10.1 chose over taking on a grid library for free resizing nobody asked
 * for.
 */
'use client'
import React, { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Loader2, Plus, RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMobile } from '@/hooks/use-mobile'
import { useAnalyticsDashboard, useChartData, useCsvExport } from '@/hooks/useAnalyticsDashboard'
import type { ChartKind, Widget, WidgetWidth } from '@/types/analytics'
import type { FilterNodeInput, SpecInput } from '@/server/analytics/spec'
import { ChartCard } from './ChartCard'
import { SidePanel } from './SidePanel'
import { LogsOverlay } from './LogsOverlay'
import { FilterBar, decodeFilters, encodeFilters } from './FilterBar'
import { WhenFilter, type TimeOfDay } from './WhenFilter'
import { OutcomeOrderEditor, type OutcomeRanking } from './OutcomeOrderEditor'
import { adaptSpecToKind, suggestSpec, suggestTitle } from './suggest'
import { coverage } from './chartData'

type Props = {
  project: { id: string } | null | undefined
  agent: { id: string; name?: string } | null | undefined
  dateRange: { from: string; to: string }
  quickFilter?: string
  isCustomRange?: boolean
  isLoading?: boolean
  /** The tab stays mounted while hidden; do not fetch for a screen nobody is looking at. */
  isActive?: boolean
}

/** Phase 3 adds WhatsApp and Journeys. An empty tab looks broken, so only Voice ships (§10.2). */
const SOURCES = [{ id: 'voice', label: 'Voice' }] as const

export default function AnalyticsCanvas({ agent, dateRange, isLoading, isActive = true }: Props) {
  const agentId = agent?.id
  // useMobile returns { isMobile, mounted } — taking the object whole makes
  // every `!isMobile` false, which silently hides the panel and kills dragging
  const { isMobile } = useMobile()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dashboard, fields, save } = useAnalyticsDashboard(agentId, Boolean(isActive))

  const [draft, setDraft] = useState<Widget[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ widget: Widget; value: string | null | undefined } | null>(null)
  const [draggingType, setDraggingType] = useState<ChartKind | null>(null)
  const [orderEditor, setOrderEditor] = useState(false)

  const widgets = useMemo(() => draft ?? dashboard.data?.widgets ?? [], [draft, dashboard.data])
  const canEdit = dashboard.data?.can_edit === true
  const downloadDisabled = dashboard.data?.download_disabled === true
  const dirty = draft !== null
  const catalog = useMemo(() => fields.data?.fields ?? [], [fields.data])
  const ranking = (fields.data?.outcome_ranking ?? null) as OutcomeRanking
  const csv = useCsvExport(agentId)

  // a filtered view is a link somebody can send (§10.3)
  const filters = useMemo(() => decodeFilters(searchParams.get('af')), [searchParams])
  const setFilters = useCallback(
    (next: FilterNodeInput[]) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next.length) params.set('af', encodeFilters(next))
      else params.delete('af')
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  // the hours and the days live in the URL too, so a shared link shows the
  // same numbers the sender was looking at
  const when = useMemo(
    () => ({
      timeOfDay: decodeWhen(searchParams.get('at')),
      days: (searchParams.get('dow') ?? '').split(',').map(Number).filter((n) => n >= 1 && n <= 7),
    }),
    [searchParams]
  )
  const setWhen = useCallback(
    (next: { timeOfDay: TimeOfDay; days: number[] }) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next.timeOfDay) params.set('at', `${next.timeOfDay.from}-${next.timeOfDay.to}`)
      else params.delete('at')
      if (next.days.length && next.days.length < 7) params.set('dow', next.days.join(','))
      else params.delete('dow')
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const range = useMemo(() => ({ from: dateRange.from.slice(0, 10), to: dateRange.to.slice(0, 10) }), [dateRange])
  const charts = useChartData(agentId, widgets, range, filters, when, Boolean(isActive))

  const selected = widgets.find((w) => w.id === selectedId) ?? null
  const edit = useCallback(
    (id: string, patch: Partial<Widget>) =>
      setDraft((prev) => (prev ?? widgets).map((w) => (w.id === id ? { ...w, ...patch } : w))),
    [widgets]
  )

  /** A new card arrives with its settings already filled in, never blank (§10.4). */
  const makeChart = useCallback(
    (kind: ChartKind, position: number): Widget => ({
      id: `new-${crypto.randomUUID()}`,
      dashboard_id: dashboard.data?.dashboard.id ?? '',
      title: suggestTitle(kind, catalog),
      kind,
      spec: suggestSpec(kind, catalog),
      layout: { width: kind === 'kpi' ? 'quarter' : 'half' },
      position,
      live: false,
      is_seeded: false,
    }),
    [catalog, dashboard.data]
  )

  const insertAt = (kind: ChartKind, index: number) => {
    const list = [...(draft ?? widgets)]
    const card = makeChart(kind, index)
    list.splice(index, 0, card)
    setDraft(list.map((w, i) => ({ ...w, position: i })))
    setSelectedId(card.id)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // every drag handle is a real button, so tab to one and move it with the
    // arrow keys — dragging must not be the only way to arrange a dashboard
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onDragStart = (e: DragStartEvent) => {
    const kind = e.active.data.current?.chartType as ChartKind | undefined
    setDraggingType(kind ?? null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setDraggingType(null)
    if (!over) return

    // dropped in from the chart-type panel: place it where it landed
    const kind = active.data.current?.chartType as ChartKind | undefined
    if (kind) {
      const list = draft ?? widgets
      const target = list.findIndex((w) => w.id === over.id)
      insertAt(kind, target >= 0 ? target : list.length)
      return
    }

    if (active.id === over.id) return
    const list = draft ?? widgets
    const from = list.findIndex((w) => w.id === active.id)
    const to = list.findIndex((w) => w.id === over.id)
    if (from < 0 || to < 0) return
    setDraft(arrayMove(list, from, to).map((w, i) => ({ ...w, position: i })))
  }

  const duplicate = (w: Widget) => {
    const copy: Widget = { ...w, id: `new-${crypto.randomUUID()}`, title: `${w.title} copy`, is_seeded: false }
    const list = [...(draft ?? widgets)]
    list.splice(list.findIndex((x) => x.id === w.id) + 1, 0, copy)
    setDraft(list.map((x, i) => ({ ...x, position: i })))
    setSelectedId(copy.id)
  }

  /** One per appointment needs an order to rank by, so ask for one instead of failing. */
  const setGrain = (w: Widget, grain: 'interaction' | 'entity') => {
    if (grain === 'entity' && !ranking?.order?.length) {
      setOrderEditor(true)
      return
    }
    edit(w.id, {
      spec:
        grain === 'interaction'
          ? ({ ...w.spec, grain: 'interaction', dedupe: undefined } as SpecInput)
          : ({
              ...w.spec,
              grain: 'entity',
              dedupe: w.spec.dedupe ?? {
                key: { field: identityField(catalog), fallback: 'call_id' },
                winner: 'best_outcome',
                ranking_ref: 'agent',
                lookback_days: 90,
              },
            } as SpecInput),
    })
  }

  const persist = () => {
    if (!draft) return
    const original = dashboard.data?.widgets ?? []
    save.mutate(
      {
        widgets: draft.map((w, i) => ({
          // a brand-new card carries a placeholder id the database must not be given
          ...(w.id.startsWith('new-') ? {} : { id: w.id }),
          title: w.title,
          kind: w.kind,
          spec: w.spec,
          layout: w.layout ?? { width: 'half' },
          position: i,
          // a starter chart stops being ours the moment somebody edits it, so
          // anyone who never edits keeps getting our improvements
          is_seeded: w.is_seeded && !changed(w, original),
        })) as never,
      },
      { onSuccess: () => setDraft(null) }
    )
  }

  if (!agentId) return null

  if (dashboard.isLoading || isLoading) {
    return (
      <div className="grid grid-cols-12 gap-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn('h-28 rounded-xl', i < 4 ? 'col-span-12 sm:col-span-6 xl:col-span-3' : 'col-span-12 lg:col-span-6')}
          />
        ))}
      </div>
    )
  }

  if (dashboard.isError) return <Centered>{(dashboard.error as Error).message}</Centered>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex h-full min-h-0">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              {SOURCES.map((s) => (
                <span
                  key={s.id}
                  className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {s.label}
                </span>
              ))}
              {/* on but hidden makes every number wrong without anyone noticing */}
              <WhenFilter timeOfDay={when.timeOfDay} days={when.days} onChange={setWhen} />
              <FilterBar filters={filters} fields={catalog} onChange={setFilters} />
            </div>

            <div className="flex items-center gap-1">
              {charts.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setOrderEditor(true)} className="h-7 text-xs">
                  <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Outcome order
                </Button>
              )}
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => insertAt('bar', widgets.length)} className="h-7 text-xs">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add chart
                </Button>
              )}
              {dirty && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setDraft(null)} className="h-7 text-xs">
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Discard
                  </Button>
                  <Button size="sm" onClick={persist} disabled={save.isPending} className="h-7 text-xs">
                    {save.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>

          {save.isError && <Banner onDismiss={() => save.reset()}>{(save.error as Error).message}</Banner>}
          {csv.error && <Banner onDismiss={() => undefined}>{csv.error}</Banner>}

          <CanvasDropZone active={Boolean(draggingType)}>
            <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-12 gap-3">
                {widgets.map((w) => (
                  <ChartCard
                    key={w.id}
                    widget={w}
                    result={charts.byWidget.get(w.id)}
                    isLoading={charts.isLoading}
                    selected={selectedId === w.id}
                    canEdit={canEdit}
                    // dragging off on a phone: the canvas is for reading there
                    draggable={!isMobile}
                    categories={categoriesFor(w, catalog)}
                    onSelect={() => setSelectedId(w.id)}
                    onOpenLogs={(value) => setLogs({ widget: w, value })}
                    onEdit={() => setSelectedId(w.id)}
                    onDuplicate={() => duplicate(w)}
                    onRemove={() => {
                      setDraft((draft ?? widgets).filter((x) => x.id !== w.id))
                      if (selectedId === w.id) setSelectedId(null)
                    }}
                    onExport={() => !downloadDisabled && csv.run(w.spec, undefined, w.title)}
                    onChangeGrain={(grain) => setGrain(w, grain)}
                  />
                ))}
              </div>
            </SortableContext>

            {widgets.length === 0 && (
              <Centered>
                {canEdit ? 'Drag a chart type from the panel to start.' : 'Nothing on this dashboard yet.'}
              </Centered>
            )}
          </CanvasDropZone>
        </div>

        {/* building happens on desktop; a phone reads the dashboard and the call list */}
        {!isMobile && (
          <div className="w-72 shrink-0">
            <SidePanel
              selected={selected}
              fields={catalog}
              canEdit={canEdit}
              onAddChart={(kind) => insertAt(kind, widgets.length)}
              onChange={(spec) => selected && edit(selected.id, { spec })}
              // a new type needs the shape that draws it, or you get an empty box
              onChangeKind={(kind) =>
                selected && edit(selected.id, { kind, spec: adaptSpecToKind(selected.spec, kind, catalog) })
              }
              onChangeWidth={(width: WidgetWidth) => selected && edit(selected.id, { layout: { width } })}
              onChangeTitle={(title) => selected && edit(selected.id, { title })}
            />
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingType && (
          <div className="rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/80 px-4 py-6 text-xs font-medium text-blue-700 shadow-lg dark:bg-blue-950/60 dark:text-blue-300">
            Drop to add
          </div>
        )}
      </DragOverlay>

      <LogsOverlay
        agentId={agentId}
        widget={logs?.widget ?? null}
        dimensionValue={logs?.value}
        open={Boolean(logs)}
        onClose={() => setLogs(null)}
        downloadDisabled={downloadDisabled}
        chartTotal={logs ? coverage(charts.byWidget.get(logs.widget.id)?.data ?? [])?.total : undefined}
      />

      <OutcomeOrderEditor
        agentId={agentId}
        fields={catalog}
        current={ranking}
        open={orderEditor}
        onClose={() => setOrderEditor(false)}
        onSaved={() => fields.refetch()}
      />
    </DndContext>
  )
}

/** "22:00-02:00" from the URL. Anything else is ignored rather than crashing the page. */
export function decodeWhen(raw: string | null): TimeOfDay {
  if (!raw) return null
  const [from, to] = raw.split('-')
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/
  return clock.test(from ?? '') && clock.test(to ?? '') ? { from, to } : null
}

/** The whole scroll area accepts a drop, so a chart can be added to empty space too. */
function CanvasDropZone({ active, children }: { active: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-0 flex-1 overflow-y-auto p-4 transition-colors',
        active && 'bg-blue-50/30 dark:bg-blue-950/10',
        active && isOver && 'ring-2 ring-inset ring-blue-300 dark:ring-blue-700'
      )}
    >
      {children}
    </div>
  )
}

/**
 * The value list of whatever this chart splits by. A category that scored zero
 * has to be drawn as a zero — on a safety metric, a missing bar and a bar of
 * zero mean opposite things (§8.4).
 */
function categoriesFor(w: Widget, fields: { col: string; path: string[]; enum_values: string[] | null }[]) {
  const dim = w.spec.dimension?.field
  if (!dim) return null
  const key = `${dim.col}::${(dim.path ?? []).join('.')}`
  return fields.find((f) => `${f.col}::${f.path.join('.')}` === key)?.enum_values ?? null
}

/** Whatever the catalog thinks could identify a patient, else the caller's number. */
function identityField(fields: { col: string; path: string[]; is_identity_candidate: boolean }[]) {
  const candidate = fields.find((f) => f.is_identity_candidate)
  return candidate ? { col: candidate.col, ...(candidate.path.length ? { path: candidate.path } : {}) } : { col: 'customer_number' }
}

function changed(w: Widget, original: Widget[]): boolean {
  const was = original.find((o) => o.id === w.id)
  if (!was) return true
  return JSON.stringify(was.spec) !== JSON.stringify(w.spec) || was.title !== w.title || was.kind !== w.kind
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-40 items-center justify-center text-sm text-gray-500 dark:text-gray-400">{children}</div>
}

function Banner({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      <span>{children}</span>
      <button onClick={onDismiss} aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
