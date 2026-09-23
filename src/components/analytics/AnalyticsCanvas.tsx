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
import { ChevronRight, Loader2, PanelRightOpen, RefreshCw, RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useMobile } from '@/hooks/use-mobile'
import { useAnalyticsDashboard, useChartData, useCsvExport, type DashboardContext } from '@/hooks/useAnalyticsDashboard'
import type { CatalogField, ChartKind, FormulaContent, Widget } from '@/types/analytics'
import type { FilterNodeInput, SpecInput } from '@/server/analytics/spec'
import { ChartCard, DRAG_HANDLE_CLASS, type ChartWidget } from './ChartCard'
import { TextBlockCard } from './TextBlockCard'
import { FormulaCard } from './FormulaCard'
import { ChartErrorBoundary } from './ErrorBoundary'
import { SidePanel, CHART_TYPE_DRAG_TYPE } from './SidePanel'
import { LogsOverlay } from './LogsOverlay'
import { FilterBar, decodeFilters, encodeFilters } from './FilterBar'
import { WhenFilter, type TimeOfDay } from './WhenFilter'
import { OutcomeOrderEditor, type OutcomeRanking } from './OutcomeOrderEditor'
import { adaptSpecToKind, identityFields, outcomeField, suggestSpec, suggestTitle } from './suggest'
import { coverage } from './chartData'
import { DashboardSkeleton } from './DashboardSkeleton'
import { SuggestedStrip } from './SuggestedStrip'
import { explainFormula, explainSpec, fieldName } from './explain'
import {
  applyGridLayout, toGridLayout, nextRow, usableWidth, DEFAULT_SIZE, GRID_COLUMNS, GRID_MARGIN, ROW_HEIGHT,
} from './gridLayout'
import 'react-grid-layout/css/styles.css'
import './grid.css'

type Props = {
  project: { id: string } | null | undefined
  agent: { id: string; name?: string } | null | undefined
  dateRange: { from: string; to: string }
  isLoading?: boolean
  /** The tab stays mounted while hidden; do not fetch for a screen nobody is looking at. */
  isActive?: boolean
}

/**
 * The channels — Confluence "Analytics Phase 1 and 2 — Build Spec" §10.2.
 *
 * One row is a call on Voice, a message thread on WhatsApp, and one patient
 * chasing one goal across every channel on Journeys. A chart belongs to its
 * tab, so these cannot merge later; they are separate tabs from the start.
 *
 * §10.2 says not to ship an empty Journeys tab because it looks broken — and
 * the section's own mockup draws "[ Voice ] [ WhatsApp ·soon ]". The thing that
 * looks broken is a tab you can click that then shows nothing. One that is
 * plainly switched off says what is coming without pretending it is here.
 */
const SOURCES = [
  { id: 'voice', label: 'Voice', ready: true },
  { id: 'whatsapp', label: 'WhatsApp', ready: false },
  { id: 'journeys', label: 'Journeys', ready: false },
] as const

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

export default function AnalyticsCanvas({ project, agent, dateRange, isLoading, isActive = true }: Readonly<Props>) {
  const agentId = agent?.id
  const { isMobile } = useMobile()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dashboard, fields, save } = useAnalyticsDashboard(agentId, Boolean(isActive))

  const [draft, setDraft] = useState<Widget[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ widget: ChartWidget; value: string | null | undefined } | null>(null)
  const [orderEditor, setOrderEditor] = useState(false)
  const [droppingKind, setDroppingKind] = useState<ChartKind | null>(null)

  /**
   * The grid needs its width in pixels — it has no CSS of its own for that.
   *
   * This is the library's own hook now rather than a hand-rolled measurement.
   * Mine refused a zero reading and fell back to a width worked out from
   * `window.innerWidth` minus two hard-coded chrome widths — and once that
   * guess was in state nothing replaced it, so the dashboard laid itself out
   * for a window nobody had. The hook observes the real element and is where
   * the library puts `measureWidth` for the case below.
   */
  // the panel is where you build; when you are only reading a dashboard it is
  // in the way. Remembered per browser, like the app's own sidebar.
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
  const { width, containerRef, measureWidth } = useMeasuredWidth()

  /**
   * The panel opening and closing is the one resize an observer sees late: the
   * element that changes size is a *sibling* of the measured one, and the
   * observer's callback lands a frame behind the flex row redistributing.
   * Measuring twice — now, and after the frame the layout settles in — is what
   * the library documents for exactly this.
   */
  useEffect(() => {
    measureWidth()
    const id = requestAnimationFrame(measureWidth)
    return () => cancelAnimationFrame(id)
  }, [panelOpen, dashboard.isLoading, measureWidth])

  // the tab this canvas lives in is kept mounted-but-hidden by its parent
  // (`isActive`), and a display:none element reports nothing to its observer —
  // so the window itself is the one resize the observer can miss entirely
  useEffect(() => {
    window.addEventListener('resize', measureWidth)
    return () => window.removeEventListener('resize', measureWidth)
  }, [measureWidth])

  // a zero — or a sliver — is the tab being display:none or the flex row still
  // settling, not a one-column dashboard; draw the last real width rather than
  // reflowing every card into a strip (see usableWidth)
  const lastGood = useRef(0)
  const viewport = typeof window === 'undefined' ? 0 : window.innerWidth
  const gridWidth = usableWidth(width, viewport, lastGood.current)
  if (gridWidth === width) lastGood.current = width
  // the grid's first paint has to be at a real measured width; laying twelve
  // columns out at a guess and snapping afterwards is the jump on load
  const measured = lastGood.current > 0

  const widgets = useMemo(() => draft ?? dashboard.data?.widgets ?? [], [draft, dashboard.data])
  // a text block is a note, not a query — it has no valid Spec, so it never
  // reaches the query route at all
  const queryableWidgets = useMemo(() => widgets.filter((w) => w.kind !== 'text'), [widgets])
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
  const charts = useChartData(agentId, queryableWidgets, range, filters, when, Boolean(isActive))
  // the same Period/filters/When merge /api/analytics/query does, so the logs
  // overlay and CSV export read what the card on screen is showing rather than
  // the widget's own saved defaults — memoized, or a new object every render
  // re-triggers the overlay's fetch effect while it's open
  const dashboardContext = useMemo<DashboardContext>(
    () => ({ range, filters, time_of_day: when.timeOfDay, days_of_week: when.days }),
    [range, filters, when]
  )

  const selected = widgets.find((w) => w.id === selectedId) ?? null
  const edit = useCallback(
    (id: string, patch: Partial<Widget>) =>
      setDraft((prev) => (prev ?? widgets).map((w) => (w.id === id ? { ...w, ...patch } : w))),
    [widgets]
  )
  // settings have nowhere to appear if the panel is shut
  const selectChart = useCallback((id: string) => {
    setSelectedId(id)
    setPanelOpen(true)
  }, [])

  // the other way back to the chart types, for anyone who reaches for Escape
  // before reaching for a button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
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

  /** A suggestion is an ordinary card that arrived with its settings already made. */
  const addSuggested = useCallback(
    (title: string, kind: ChartKind, spec: SpecInput) => {
      const card = { ...makeChart(kind), title, spec }
      setDraft((prev) => [...(prev ?? widgets), card])
      selectChart(card.id)
    },
    [makeChart, selectChart, widgets]
  )

  const layout = useMemo(() => toGridLayout(widgets), [widgets])
  // react-grid-layout fires onLayoutChange on mount and on every width
  // measurement, which would mark a dashboard nobody touched as unsaved
  const settled = useRef(false)
  useEffect(() => {
    settled.current = false
  }, [dashboard.data])

  const onLayoutChange = (next: Layout) => {
    // the 'sm' breakpoint's layout is `{ ...l, x: 0, w: 1 }` for every widget —
    // a deliberately flattened, read-only view for a narrow screen, never a
    // real desktop arrangement. On refresh the grid can briefly measure under
    // 640px before the sidebar/chrome finishes laying out, report ITS OWN
    // single-column fallback here, and this handler used to accept it at face
    // value — permanently collapsing every card into one column and marking
    // the dashboard dirty, because the corrupted layout got written into
    // `draft`/`widgets`, which `gridWidth` correcting itself afterward can't
    // undo. Below the breakpoint, nothing reported here is real data.
    if (!canEdit || next.length !== widgets.length || gridWidth < BREAKPOINTS.lg) return
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
  const setGrain = (w: ChartWidget, grain: 'interaction' | 'entity') => {
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
            <div className="flex items-center gap-1" role="tablist" aria-label="Channel">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={s.ready}
                  // not `disabled`: a disabled button is skipped by the keyboard
                  // entirely, so a screen reader never reaches the word "soon"
                  aria-disabled={!s.ready}
                  title={s.ready ? undefined : `${s.label} analytics is coming soon`}
                  onClick={(e) => !s.ready && e.preventDefault()}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
                    s.ready
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      : 'cursor-not-allowed text-gray-400 dark:text-gray-600'
                  )}
                >
                  {s.label}
                  {!s.ready && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-normal uppercase tracking-wide text-gray-400 dark:bg-gray-800/80 dark:text-gray-500">
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </div>
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
            {/* the grid's first paint has to be at the real measured width — laying
                twelve columns out at the library's guessed default and then snapping
                to the real width is the visible jump/overlap on load. `containerRef`
                must stay mounted either way, or it never gets measured to begin with. */}
            {widgets.length > 0 && measured && (
            <ResponsiveGridLayout
              width={gridWidth}
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
              {widgets.map((w) => {
                const removeWidget = () => {
                  setDraft((draft ?? widgets).filter((x) => x.id !== w.id))
                  if (selectedId === w.id) setSelectedId(null)
                }

                let card: React.ReactNode
                if (w.kind === 'text') {
                  card = (
                    <TextBlockCard
                      widget={w}
                      selected={selectedId === w.id}
                      canEdit={canEdit}
                      draggable={!isMobile}
                      onSelect={() => selectChart(w.id)}
                      onRemove={removeWidget}
                    />
                  )
                } else if (w.kind === 'formula') {
                  card = (
                    <FormulaCard
                      widget={w}
                      result={charts.byWidget.get(w.id)}
                      isLoading={charts.isLoading}
                      selected={selectedId === w.id}
                      canEdit={canEdit}
                      draggable={!isMobile}
                      definition={explainFormula(w.spec as FormulaContent, catalog)}
                      onSelect={() => selectChart(w.id)}
                      onRemove={removeWidget}
                    />
                  )
                } else {
                  card = (
                    <ChartCard
                      widget={w as ChartWidget}
                      result={charts.byWidget.get(w.id)}
                      isLoading={charts.isLoading}
                      selected={selectedId === w.id}
                      canEdit={canEdit}
                      // dragging off on a phone: the canvas is for reading there
                      draggable={!isMobile}
                      categories={categoriesFor(w as ChartWidget, catalog, ranking)}
                      catalog={catalog}
                      catalogReady={fields.isSuccess}
                      grainLabel={grainLabel(w as ChartWidget, catalog)}
                      definition={explainSpec(w.spec as SpecInput, catalog)}
                      onSelect={() => selectChart(w.id)}
                      onOpenLogs={(value) => setLogs({ widget: w as ChartWidget, value })}
                      onEdit={() => selectChart(w.id)}
                      onDuplicate={() => duplicate(w)}
                      onRemove={removeWidget}
                      onExport={() => !downloadDisabled && csv.run(w.spec as SpecInput, undefined, w.title, dashboardContext)}
                      onChangeGrain={(grain) => setGrain(w as ChartWidget, grain)}
                    />
                  )
                }

                return (
                  <div key={w.id}>
                    {/* the eleven cards beside this one keep working */}
                    <ChartErrorBoundary label={w.title}>{card}</ChartErrorBoundary>
                  </div>
                )
              })}
              </ResponsiveGridLayout>
            )}
          </div>

          {widgets.length === 0 && (
            <Centered>{canEdit ? 'Drag a chart type from the panel to start.' : 'Nothing on this dashboard yet.'}</Centered>
          )}

          {/* §10's mockup puts this under the canvas: charts worth building for
              this agent, each saying why. The rules have been in suggest.ts
              since phase 1 — this is what finally shows them. */}
          <SuggestedStrip fields={catalog} widgets={widgets} canEdit={canEdit} onAdd={addSuggested} />
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
            ranking={ranking}
            canEdit={canEdit}
            onBack={() => setSelectedId(null)}
            onAddChart={(kind) => addChart(kind)}
            onDragChartType={setDroppingKind}
            onChange={(spec) => selected && edit(selected.id, { spec })}
            // a new type needs the shape that draws it, or you get an empty box
            onChangeKind={(kind) =>
              selected && edit(selected.id, { kind, spec: adaptSpecToKind(selected.spec as SpecInput, kind, catalog) })
            }
            onChangeTitle={(title) => selected && edit(selected.id, { title })}
          />
        </div>
      )}

      <LogsOverlay
        agentId={agentId}
        projectId={project?.id ?? ''}
        widget={logs?.widget ?? null}
        grainLabel={logs ? grainLabel(logs.widget, catalog) : 'Every call'}
        seriesLabel={logs?.widget.spec.dimension?.field ? fieldName(logs.widget.spec.dimension.field, catalog) : null}
        dimensionValue={logs?.value}
        open={Boolean(logs)}
        onClose={() => setLogs(null)}
        downloadDisabled={downloadDisabled}
        chartTotal={logs ? coverage(charts.byWidget.get(logs.widget.id)?.data ?? [])?.total : undefined}
        dashboard={dashboardContext}
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
 * The value list of whatever this chart splits by, in display order. A
 * category that scored zero has to be drawn as a zero — on a safety metric, a
 * missing bar and a bar of zero mean opposite things (§8.4).
 *
 * When this is the outcome field, the order configured in OutcomeOrderEditor
 * goes first — otherwise "drag to reorder" changed only the dedupe tie-break
 * and never what the chart itself showed.
 */
function categoriesFor(
  w: ChartWidget,
  fields: { col: string; path: string[]; enum_values: string[] | null }[],
  ranking?: OutcomeRanking
) {
  const dim = w.spec.dimension?.field
  if (!dim) return null
  const key = `${dim.col}::${(dim.path ?? []).join('.')}`
  const values = fields.find((f) => `${f.col}::${f.path.join('.')}` === key)?.enum_values ?? null
  if (!values) return null
  const rankingKey = ranking && `${ranking.field.col}::${(ranking.field.path ?? []).join('.')}`
  if (rankingKey !== key || !ranking) return values
  const ranked = ranking.order.filter((v) => values.includes(v))
  const rest = values.filter((v) => !ranked.includes(v))
  return [...ranked, ...rest]
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
function grainLabel(w: ChartWidget, fields: CatalogField[]): string {
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

function Centered({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex h-40 items-center justify-center text-sm text-gray-500 dark:text-gray-400">{children}</div>
}

function Banner({ children, onDismiss }: Readonly<{ children: React.ReactNode; onDismiss: () => void }>) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
      <span>{children}</span>
      <button onClick={onDismiss} aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/**
 * The container's width, measured for real and kept up to date.
 *
 * react-grid-layout ships `useContainerWidth`, but it attaches its
 * ResizeObserver in an effect that bails out when `containerRef.current` is
 * null and then never runs again — its only dependency is a callback whose
 * identity stops changing after the first render. This canvas renders a
 * loading skeleton first, so the measured div does not exist on that first
 * run: the observer is never attached at all, and the width only ever changes
 * when something manually re-measures. Measure at the wrong moment — mid
 * animation, or while the tab is still hidden — and the canvas keeps that
 * width until the next manual trigger, which is the strip of cards a refresh
 * "fixes".
 *
 * A callback ref cannot miss the mount: it fires with the node whenever the
 * node appears, however late, and the observer is attached there.
 */
function useMeasuredWidth() {
  const [width, setWidth] = useState(0)
  const node = useRef<HTMLDivElement | null>(null)
  const observer = useRef<ResizeObserver | null>(null)

  const containerRef = useCallback((next: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    node.current = next
    if (!next) return

    setWidth(Math.round(next.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return
    observer.current = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    observer.current.observe(next)
  }, [])

  useEffect(() => () => observer.current?.disconnect(), [])

  const measureWidth = useCallback(() => {
    if (node.current) setWidth(Math.round(node.current.getBoundingClientRect().width))
  }, [])

  return { width, containerRef, measureWidth }
}
