/**
 * The dashboard canvas — Confluence "Analytics Phase 1 and 2 — Build Spec" §10.
 *
 * This replaces the hand-coded Overview. Every tile and chart on it is now an
 * ordinary saved chart object: editable, duplicable, clickable through to the
 * calls, and exportable, instead of seven special cases in a 1,478-line file.
 */
'use client'
import React, { useCallback, useMemo, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { Loader2, Plus, RotateCcw, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMobile } from '@/hooks/use-mobile'
import { useAnalyticsDashboard, useChartData, useCsvExport } from '@/hooks/useAnalyticsDashboard'
import type { ChartKind, Widget, WidgetWidth } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'
import { ChartCard } from './ChartCard'
import { SidePanel } from './SidePanel'
import { LogsOverlay } from './LogsOverlay'
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

export default function AnalyticsCanvas({ project, agent, dateRange, isLoading, isActive = true }: Props) {
  const agentId = agent?.id
  const isMobile = useMobile()
  const { dashboard, fields, save } = useAnalyticsDashboard(agentId, Boolean(isActive))

  const [draft, setDraft] = useState<Widget[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ widget: Widget; value: string | null | undefined } | null>(null)

  const widgets = useMemo(() => draft ?? dashboard.data?.widgets ?? [], [draft, dashboard.data])
  const canEdit = dashboard.data?.can_edit === true
  const downloadDisabled = dashboard.data?.download_disabled === true
  const dirty = draft !== null
  const catalog = fields.data?.fields ?? []
  const csv = useCsvExport(agentId)

  const range = useMemo(() => ({ from: dateRange.from.slice(0, 10), to: dateRange.to.slice(0, 10) }), [dateRange])
  const charts = useChartData(agentId, widgets, range, [], Boolean(isActive))

  const selected = widgets.find((w) => w.id === selectedId) ?? null
  const edit = useCallback(
    (id: string, patch: Partial<Widget>) => setDraft((prev) => (prev ?? widgets).map((w) => (w.id === id ? { ...w, ...patch } : w))),
    [widgets]
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const list = draft ?? widgets
    const from = list.findIndex((w) => w.id === active.id)
    const to = list.findIndex((w) => w.id === over.id)
    if (from < 0 || to < 0) return
    setDraft(arrayMove(list, from, to).map((w, i) => ({ ...w, position: i })))
  }

  const addChart = (kind: ChartKind) => {
    const blank: Widget = {
      id: `new-${crypto.randomUUID()}`,
      dashboard_id: dashboard.data?.dashboard.id ?? '',
      title: 'New chart',
      kind,
      spec: { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 }, ...(kind === 'line' ? { bucket: 'day' } : {}) } as SpecInput,
      layout: { width: kind === 'kpi' ? 'quarter' : 'half' },
      position: widgets.length,
      live: false,
      is_seeded: false,
    }
    setDraft([...(draft ?? widgets), blank])
    setSelectedId(blank.id)
  }

  const duplicate = (w: Widget) => {
    const copy: Widget = { ...w, id: `new-${crypto.randomUUID()}`, title: `${w.title} copy`, is_seeded: false, position: widgets.length }
    setDraft([...(draft ?? widgets), copy])
    setSelectedId(copy.id)
  }

  const persist = () => {
    if (!draft) return
    save.mutate(
      {
        widgets: draft.map((w, i) => ({
          // a brand-new card has a placeholder id the database must not be given
          ...(w.id.startsWith('new-') ? {} : { id: w.id }),
          title: w.title,
          kind: w.kind,
          spec: w.spec,
          layout: w.layout ?? { width: 'half' },
          position: i,
          // editing a starter chart makes it this client's own, so anyone who
          // never edits keeps getting our improvements
          is_seeded: w.is_seeded && !dirtyWidget(w, dashboard.data?.widgets ?? []),
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
          <Skeleton key={i} className={cn('h-28 rounded-xl', i < 4 ? 'col-span-12 sm:col-span-6 xl:col-span-3' : 'col-span-12 lg:col-span-6')} />
        ))}
      </div>
    )
  }

  if (dashboard.isError) {
    return <Centered>{(dashboard.error as Error).message}</Centered>
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
          <div className="flex items-center gap-1">
            {SOURCES.map((s) => (
              <span
                key={s.id}
                className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {s.label}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {charts.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
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

        {save.isError && (
          <Banner onDismiss={() => save.reset()}>{(save.error as Error).message}</Banner>
        )}
        {csv.error && <Banner onDismiss={() => undefined}>{csv.error}</Banner>}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                    onSelect={() => setSelectedId(w.id)}
                    onOpenLogs={(value) => setLogs({ widget: w, value })}
                    onEdit={() => setSelectedId(w.id)}
                    onDuplicate={() => duplicate(w)}
                    onRemove={() => {
                      setDraft((draft ?? widgets).filter((x) => x.id !== w.id))
                      if (selectedId === w.id) setSelectedId(null)
                    }}
                    onExport={() => !downloadDisabled && csv.run(w.spec, undefined, w.title)}
                    onChangeGrain={(grain) =>
                      edit(w.id, {
                        spec:
                          grain === 'interaction'
                            ? ({ ...w.spec, grain: 'interaction', dedupe: undefined } as SpecInput)
                            : ({ ...w.spec, grain: 'entity' } as SpecInput),
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {widgets.length === 0 && <Centered>Nothing on this dashboard yet. Add a chart from the panel.</Centered>}
        </div>
      </div>

      {/* building happens on desktop; a phone reads the dashboard and the call list */}
      {!isMobile && (
        <div className="w-72 shrink-0">
          <SidePanel
            selected={selected}
            fields={catalog}
            canEdit={canEdit}
            onAddChart={addChart}
            onChange={(spec) => selected && edit(selected.id, { spec })}
            onChangeKind={(kind) => selected && edit(selected.id, { kind })}
            onChangeWidth={(width: WidgetWidth) => selected && edit(selected.id, { layout: { width } })}
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
    </div>
  )
}

/** A seeded chart stops being ours the moment somebody changes it. */
function dirtyWidget(w: Widget, original: Widget[]): boolean {
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
