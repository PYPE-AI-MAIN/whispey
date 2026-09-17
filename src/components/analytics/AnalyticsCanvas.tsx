/**
 * The dashboard canvas — Confluence "Analytics Phase 1 and 2 — Build Spec" §10.
 *
 * This replaces the hand-coded Overview. Every tile and chart on it is an
 * ordinary saved chart object: editable, duplicable, clickable through to the
 * calls, and exportable, instead of seven special cases in a 1,478-line file.
 *
 * §10.1 weighed dnd-kit plus a width toggle against a grid library and picked
 * the toggle, with one condition: "free resizing is what forces a grid library,
 * and nobody has asked for it." Somebody has, so the layout is
 * react-grid-layout's now — drag a card anywhere, drag its corner to any size,
 * and everything else moves out of the way.
 */
'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ResponsiveGridLayout, type Layout } from 'react-grid-layout'
import { ChevronRight, Loader2, PanelRightOpen, Plus, RefreshCw, RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useMobile } from '@/hooks/use-mobile'
import { useAnalyticsDashboard, useChartData, useCsvExport } from '@/hooks/useAnalyticsDashboard'
import type { CatalogField, ChartKind, Widget } from '@/types/analytics'
import type { FilterNodeInput, SpecInput } from '@/server/analytics/spec'
import { ChartCard, DRAG_HANDLE_CLASS } from './ChartCard'
import { SidePanel, CHART_TYPE_DRAG_TYPE } from './SidePanel'
import { LogsOverlay } from './LogsOverlay'
import { FilterBar, decodeFilters, encodeFilters } from './FilterBar'
import { WhenFilter, type TimeOfDay } from './WhenFilter'
import { OutcomeOrderEditor, type OutcomeRanking } from './OutcomeOrderEditor'
import { adaptSpecToKind, identityFields, outcomeField, suggestSpec, suggestTitle } from './suggest'
import { coverage } from './chartData'
import { DashboardSkeleton } from './DashboardSkeleton'
import { explainSpec } from './explain'
import {
  applyGridLayout, toGridLayout, nextRow, DEFAULT_SIZE, GRID_COLUMNS, GRID_MARGIN, MIN_SIZE, ROW_HEIGHT,
} from './gridLayout'
import 'react-grid-layout/css/styles.css'
import './grid.css'

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

/**
 * Cards stack into one column below this (§10.9).
 *
 * Measured on the canvas, not the window — and the canvas has already lost the
 * app sidebar and, when it is open, 288px of settings panel. At 1024 a 1440px
 * laptop with the panel open fell to a single column, so opening and closing
 * the panel rearranged the whole dashboard instead of just making it narrower.
 * 640px of canvas is where twelve columns genuinely stop working.
 */
const BREAKPOINTS = { lg: 640, sm: 0 }
const COLUMNS = { lg: GRID_COLUMNS, sm: 1 }

export default function AnalyticsCanvas({ agent, dateRange, isLoading, isActive = true }: Props) {
  const agentId = agent?.id
  const { isMobile } = useMobile()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dashboard, fields, save } = useAnalyticsDashboard(agentId, Boolean(isActive))

  const [draft, setDraft] = useState<Widget[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ widget: Widget; value: string | null | undefined } | null>(null)
  const [orderEditor, setOrderEditor] = useState(false)
  const [droppingKind, setDroppingKind] = useState<ChartKind | null>(null)

  /**
   * The grid needs its width in pixels — it has no CSS of its own for that.
   *
   * Measured here rather than with the library's hook, which starts at a
   * hard-coded 1280 and only corrects if its observer happens to fire. When it
   * did not, the grid laid itself out wider than the page and the right-hand
   * cards disappeared under the settings panel.
   */
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const measure = useCallback(() => {
    const node = containerRef.current
    // zero is never a real layout — it means the tab is display:none or the
    // node is between renders. Keeping the last good width stops the grid
    // blanking out, since it will not draw without one.
    if (node && node.clientWidth > 0) setWidth(node.clientWidth)
  }, [])
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    // the tab is display:none until Overview is opened, which reports zero
    window.addEventListener('resize', measure)
    // and one late attempt, for the case where the first measurement lands
    // before the layout settles and the observer then has nothing to report
    const settle = setTimeout(measure, 200)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      clearTimeout(settle)
    }
  }, [measure])

  // the panel is where you build; when you are only reading it is in the way
  const [panelOpen, setPanelOpen] = useState(true)
  useEffect(() => {
    try {
      setPanelOpen(localStorage.getItem('analytics.panel') !== 'closed')
    } catch {
      /* private window or storage blocked — it just starts open */
    }
  }, [])
  const togglePanel = useCallback(() => {
    setPanelOpen((open) => {
      try {
        localStorage.setItem('analytics.panel', open ? 'closed' : 'open')
      } catch {
        /* nothing to remember it with; the toggle still works for this visit */
      }
      return !open
    })
  }, [])
  // the panel changes the width by 288px; measure on the next frame rather than
  // waiting for the observer, so the cards never render at the old width
  useEffect(() => {
    const frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [panelOpen, isActive, measure])

  const widgets = useMemo(() => draft ?? dashboard.data?.widgets ?? [], [draft, dashboard.data])
  const canEdit = dashboard.data?.can_edit === true
  const downloadDisabled = dashboard.data?.download_disabled === true
  const dirty = draft !== null
  const catalog = useMemo(() => fields.data?.fields ?? [], [fields.data])
  const ranking = (fields.data?.outcome_ranking ?? null) as OutcomeRanking
  const csv = useCsvExport(agentId)

  // a filtered view is a link somebody can send (§10.3)
  const filters = useMemo(() => decodeFilters(searchParams.get('af')), [searchParams])
  const when = useMemo(
    () => ({
      timeOfDay: decodeWhen(searchParams.get('at')),
      days: (searchParams.get('dow') ?? '').split(',').map(Number).filter((n) => n >= 1 && n <= 7),
    }),
    [searchParams]
  )
  const setParam = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
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
  const selectChart = useCallback((id: string) => {
    setSelectedId(id)
    setPanelOpen(true)
  }, [])

  /** A new card arrives with its settings already filled in, never blank (§10.4). */
  const makeChart = useCallback(
    (kind: ChartKind, at?: { x: number; y: number }): Widget => ({
      id: `new-${crypto.randomUUID()}`,
      dashboard_id: dashboard.data?.dashboard.id ?? '',
      title: suggestTitle(kind, catalog),
      kind,
      spec: suggestSpec(kind, catalog),
      // a real row, not Infinity: it is a number, it survives a spread, and it
      // becomes null in JSON, which the save route rejects
      layout: { ...(at ?? { x: 0, y: nextRow(widgets) }), ...DEFAULT_SIZE[kind] },
      position: 0,
      live: false,
      is_seeded: false,
    }),
    [catalog, dashboard.data, widgets]
  )

  const addChart = (kind: ChartKind, at?: { x: number; y: number }) => {
    const card = makeChart(kind, at)
    setDraft([...(draft ?? widgets), card])
    selectChart(card.id)
  }

  const layout = useMemo(() => toGridLayout(widgets), [widgets])
  // react-grid-layout fires onLayoutChange on mount and on every width
  // measurement, which would mark a dashboard nobody touched as unsaved
  const settled = useRef(false)
  useEffect(() => {
    settled.current = false
  }, [dashboard.data])

  const onLayoutChange = (next: Layout) => {
    if (!canEdit || next.length !== widgets.length) return
    const moved = applyGridLayout(widgets, next)
    if (!settled.current) {
      settled.current = true
      // the first callback is the grid reporting what we gave it
      if (JSON.stringify(moved.map((w) => w.layout)) === JSON.stringify(widgets.map((w) => w.layout))) return
    }
    setDraft(moved)
  }

  const duplicate = (w: Widget) => {
    const copy: Widget = {
      ...w,
      id: `new-${crypto.randomUUID()}`,
      title: `${w.title} copy`,
      is_seeded: false,
      layout: { ...toGridLayout([w])[0], i: undefined, y: nextRow(widgets) } as unknown as Widget['layout'],
    }
    setDraft([...(draft ?? widgets), copy])
    selectChart(copy.id)
  }

  /** One per patient needs an order to rank by, so ask for one instead of failing. */
  const setGrain = (w: Widget, grain: 'interaction' | 'entity') => {
    if (grain === 'interaction') {
      edit(w.id, { spec: { ...w.spec, grain: 'interaction', dedupe: undefined } as SpecInput })
      return
    }
    if (!ranking?.order?.length) {
      setOrderEditor(true)
      return
    }
    edit(w.id, { spec: entitySpec(w.spec, catalog, ranking) })
  }

  const persist = () => {
    if (!draft) return
    const original = dashboard.data?.widgets ?? []
    const placed = applyGridLayout(draft, toGridLayout(draft))
    save.mutate(
      {
        widgets: placed.map((w, i) => ({
          // a brand-new card carries a placeholder id the database must not be given
          ...(w.id.startsWith('new-') ? {} : { id: w.id }),
          title: w.title,
          kind: w.kind,
          spec: w.spec,
          layout: w.layout,
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

  if (dashboard.isLoading || isLoading) return <DashboardSkeleton />

  if (dashboard.isError) return <Centered>{(dashboard.error as Error).message}</Centered>

  return (
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
            <WhenFilter
              timeOfDay={when.timeOfDay}
              days={when.days}
              onChange={(next) =>
                setParam({
                  at: next.timeOfDay ? `${next.timeOfDay.from}-${next.timeOfDay.to}` : null,
                  dow: next.days.length && next.days.length < 7 ? next.days.join(',') : null,
                })
              }
            />
            <FilterBar
              filters={filters}
              fields={catalog}
              onChange={(next: FilterNodeInput[]) => setParam({ af: next.length ? encodeFilters(next) : null })}
            />
          </div>

          <div className="flex items-center gap-1">
            {charts.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
            <Button
              size="sm"
              variant="ghost"
              title="Run every chart again"
              onClick={() => charts.refetch()}
              disabled={charts.isFetching}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => setOrderEditor(true)} className="h-7 text-xs">
                <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Outcome order
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => addChart('bar')} className="h-7 text-xs">
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
        {charts.error && <Banner onDismiss={() => charts.refetch()}>{charts.error.message}</Banner>}
        {csv.error && <Banner onDismiss={() => undefined}>{csv.error}</Banner>}

        <div
          className={cn(
            // overflow-x-hidden, not auto: the grid is measured to fit, and a
            // sideways scrollbar means the measurement was wrong, not that the
            // dashboard is wider than the screen
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3',
            droppingKind && 'bg-blue-50/30 dark:bg-blue-950/10'
          )}
        >
          {/* measured without the padding — the grid lays out inside this box,
              and measuring the padded parent made it 24px too wide */}
          <div ref={containerRef} className="w-full">
            {/* never blank: before the width is known there is still a dashboard
                here, it just cannot be placed yet */}
            {width === 0 && widgets.length > 0 && <DashboardSkeleton />}
            {width > 0 && widgets.length > 0 && (
            <ResponsiveGridLayout
              width={width}
              layouts={{ lg: layout, sm: layout.map((l) => ({ ...l, x: 0, w: 1 })) }}
              breakpoints={BREAKPOINTS}
              cols={COLUMNS}
              rowHeight={ROW_HEIGHT}
              margin={GRID_MARGIN}
              containerPadding={[0, 0]}
              // a click anywhere on a card selects it, so a drag starts from the grip
              dragConfig={{ enabled: canEdit && !isMobile, handle: `.${DRAG_HANDLE_CLASS}` }}
              resizeConfig={{ enabled: canEdit && !isMobile, handles: ['se'] }}
              dropConfig={{
                enabled: canEdit && !isMobile,
                defaultItem: DEFAULT_SIZE[droppingKind ?? 'bar'],
              }}
              onLayoutChange={onLayoutChange}
              onDrop={(_next, item, event) => {
                const kind = (event as DragEvent).dataTransfer?.getData(CHART_TYPE_DRAG_TYPE) as ChartKind
                setDroppingKind(null)
                if (kind && DEFAULT_SIZE[kind]) addChart(kind, { x: item?.x ?? 0, y: item?.y ?? 0 })
              }}
            >
              {widgets.map((w) => (
                <div key={w.id}>
                  <ChartCard
                    widget={w}
                    result={charts.byWidget.get(w.id)}
                    isLoading={charts.isLoading}
                    selected={selectedId === w.id}
                    canEdit={canEdit}
                    // dragging off on a phone: the canvas is for reading there
                    draggable={!isMobile}
                    categories={categoriesFor(w, catalog)}
                    grainLabel={grainLabel(w, catalog)}
                    definition={explainSpec(w.spec, catalog)}
                    onSelect={() => selectChart(w.id)}
                    onOpenLogs={(value) => setLogs({ widget: w, value })}
                    onEdit={() => selectChart(w.id)}
                    onDuplicate={() => duplicate(w)}
                    onRemove={() => {
                      setDraft((draft ?? widgets).filter((x) => x.id !== w.id))
                      if (selectedId === w.id) setSelectedId(null)
                    }}
                    onExport={() => !downloadDisabled && csv.run(w.spec, undefined, w.title)}
                    onChangeGrain={(grain) => setGrain(w, grain)}
                  />
                </div>
              ))}
              </ResponsiveGridLayout>
            )}
          </div>

          {widgets.length === 0 && (
            <Centered>{canEdit ? 'Drag a chart type from the panel to start.' : 'Nothing on this dashboard yet.'}</Centered>
          )}
        </div>
      </div>

      {/* building happens on desktop; a phone reads the dashboard and the call list */}
      {!isMobile && !panelOpen && (
        <button
          onClick={togglePanel}
          aria-label="Show chart settings"
          className="flex w-8 shrink-0 items-center justify-center border-l border-gray-200 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:border-gray-800 dark:hover:bg-gray-900"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      )}

      {!isMobile && panelOpen && (
        <div className="relative w-72 shrink-0">
          <button
            onClick={togglePanel}
            aria-label="Hide chart settings"
            className="absolute right-2 top-2.5 z-10 rounded p-1 text-gray-400 transition hover:bg-gray-200/60 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <SidePanel
            selected={selected}
            fields={catalog}
            canEdit={canEdit}
            onAddChart={(kind) => addChart(kind)}
            onDragChartType={setDroppingKind}
            onChange={(spec) => selected && edit(selected.id, { spec })}
            // a new type needs the shape that draws it, or you get an empty box
            onChangeKind={(kind) =>
              selected && edit(selected.id, { kind, spec: adaptSpecToKind(selected.spec, kind, catalog) })
            }
            onChangeWidth={(columns) =>
              selected &&
              edit(selected.id, {
                layout: {
                  ...(toGridLayout([selected])[0]),
                  w: Math.max(columns, MIN_SIZE[selected.kind].w),
                } as Widget['layout'],
              })
            }
            onChangeTitle={(title) => selected && edit(selected.id, { title })}
          />
        </div>
      )}

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
    </div>
  )
}

/** "22:00-02:00" from the URL. Anything else is ignored rather than crashing the page. */
export function decodeWhen(raw: string | null): TimeOfDay {
  if (!raw) return null
  const [from, to] = raw.split('-')
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/
  return clock.test(from ?? '') && clock.test(to ?? '') ? { from, to } : null
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

const asRef = (f: { col: string; path: string[] }) => ({ col: f.col, ...(f.path.length ? { path: f.path } : {}) })

/**
 * Counting one row per patient, with everything the query builder insists on.
 *
 * `best_outcome` without an outcome field is rejected by the schema, which is
 * how the Count control produced a card reading "this chart needs fixing" — it
 * set the winner and never set the field to rank by. With no outcome to rank,
 * the honest fallback is the most recent attempt, not a broken chart.
 */
function entitySpec(spec: SpecInput, fields: CatalogField[], ranking: OutcomeRanking): SpecInput {
  const key = identityFields(fields)[0]
  const outcome = outcomeField(fields, ranking?.field)
  return {
    ...spec,
    grain: 'entity',
    dedupe: {
      key: { field: key ? asRef(key) : { col: 'customer_number' }, fallback: 'call_id' },
      ...(outcome
        ? { winner: 'best_outcome' as const, outcome: asRef(outcome), ranking_ref: 'agent' as const }
        : { winner: 'most_recent' as const }),
      lookback_days: 90,
    },
  }
}

/** "Every call", or the name of whatever the chart counts one of. */
function grainLabel(w: Widget, fields: CatalogField[]): string {
  const key = w.spec.dedupe?.key.field
  if (w.spec.grain !== 'entity' || !key) return 'Every call'
  const match = fields.find((f) => f.col === key.col && f.path.join('.') === (key.path ?? []).join('.'))
  return `One per ${(match?.label ?? key.path?.[key.path.length - 1] ?? key.col).toLowerCase()}`
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
