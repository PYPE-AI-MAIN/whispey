/**
 * Journeys tab — Confluence "Analytics Phase 3 and 4 — Build Spec" §3.5.3.
 * A campaign selector, headline numbers, its funnel, an activity trend, a
 * small chart builder, and the most recently updated journeys with their full
 * timelines. Only exists in the org view (§3.5.4) — a per-agent canvas has
 * nothing cross-agent to show.
 *
 * Campaigns and journeys are created implicitly by `ingest_journey_event`
 * (§3.3.2), so the only real state here is "no campaign has sent an event
 * yet" — not an error, just nothing to show.
 */
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Activity, BarChart3, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FileCode2, Flag,
  LineChart as LineChartIcon, Loader2, MessageCircle, Phone, PhoneMissed, PieChart as PieChartIcon, Plus, Search,
  SlidersHorizontal, Table2, TrendingDown, UserPlus, Users, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { formatBucket, shortLabel } from './chartData'
import { PIE_MAX_SLICES, SERIES_COLORS } from './ChartRenderer'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { RangePicker } from './OrgOverview'
import {
  useActiveJourneys,
  useCampaigns,
  useChartDimensions,
  useCustomChart,
  useFunnel,
  useJourneyFilterOptions,
  useJourneyCharts,
  useRecentJourneys,
  type ChartKind,
  type ChartMetric,
  type CustomChartPoint,
  type JourneyEvent,
  type JourneyFilters,
  type JourneySummary,
  type SavedChart,
} from '@/hooks/useJourneys'
import type { OverviewRange } from '@/hooks/useOrgOverview'

const ALL = '__all__'
const CARD = 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900'
const CARD_TITLE = 'text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'
const INK = 'text-gray-900 dark:text-gray-100'
const MUTED = 'text-gray-500 dark:text-gray-400'
const GRID_STROKE = 'stroke-gray-200 dark:stroke-gray-800'
const AXIS = { fontSize: 11, fill: 'currentColor' } as const
const fmt = (n: number) => n.toLocaleString()

function Skel({ className }: Readonly<{ className?: string }>) {
  return <div className={cn('animate-pulse rounded-md bg-gray-100 dark:bg-gray-800', className)} />
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (!Number.isFinite(s)) return ''
  if (s < 60) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)}m ago`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)}h ago`
  const d = h / 24
  if (d < 30) return `${Math.floor(d)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Theme-aware tooltip — recharts' default inline style is always white, which glows in dark mode. */
function ChartTooltip({
  active, payload, label, labelFormatter, valueName, total,
}: Readonly<{
  active?: boolean; payload?: { value?: number; name?: string; color?: string; payload?: { bucket?: string } }[]
  label?: string; labelFormatter?: (l: string) => string; valueName?: string; total?: number
}>) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const value = Number(p.value ?? 0)
  const heading = labelFormatter ? labelFormatter(String(label ?? p.payload?.bucket ?? '')) : String(label ?? p.payload?.bucket ?? p.name ?? '')
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <p className={cn('mb-1 font-medium', INK)}>{heading}</p>
      <p className={cn('flex items-center gap-1.5 tabular-nums', MUTED)}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color ?? 'var(--analytics-series-1)' }} />
        {valueName ?? 'Count'}: <span className={cn('font-semibold', INK)}>{fmt(value)}</span>
        {total ? <span>({Math.round((value / total) * 100)}%)</span> : null}
      </p>
    </div>
  )
}

function Segmented<T extends string>({
  value, onChange, options, label, iconOnly,
}: Readonly<{ value: T; onChange: (v: T) => void; label: string; iconOnly?: boolean; options: { value: T; label: string; icon?: React.ReactNode; disabled?: boolean }[] }>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-gray-900">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          title={o.label}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
            value === o.value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-50' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          )}
        >
          {o.icon}
          {iconOnly && o.icon ? <span className="sr-only">{o.label}</span> : <span>{o.label}</span>}
        </button>
      ))}
    </div>
  )
}

/* ───────────────────────────── Toolbar ───────────────────────────── */

const FILTER_LABELS: Record<keyof JourneyFilters, string> = { channel: 'Channel', status: 'Status', outcome: 'Outcome', agentId: 'Agent' }

function useFilterChoices(projectId: string, campaignId: string) {
  const { data: options } = useJourneyFilterOptions(projectId, campaignId, true)
  const { data: agents } = useSupabaseQuery<{ id: string; name: string }>('pype_voice_agents', {
    select: 'id, name',
    filters: [{ column: 'project_id', operator: 'eq', value: projectId }],
  })
  const list = (xs?: string[]) => xs?.map((x) => ({ value: x, label: x }))
  return {
    channel: list(options?.channels), status: list(options?.statuses), outcome: list(options?.outcomes),
    agentId: agents?.map((a) => ({ value: a.id, label: a.name })),
  } as Record<keyof JourneyFilters, { value: string; label: string }[] | undefined>
}

/** All four filters behind one button — the toolbar stays one calm row instead of four dropdowns. */
function FiltersPopover({
  projectId, campaignId, filters, onChange,
}: Readonly<{ projectId: string; campaignId: string; filters: JourneyFilters; onChange: (f: JourneyFilters) => void }>) {
  const choices = useFilterChoices(projectId, campaignId)
  const active = Object.values(filters).filter(Boolean).length
  const set = (key: keyof JourneyFilters) => (value: string) => onChange({ ...filters, [key]: value === ALL ? undefined : value })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          {active > 0 && <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white">{active}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        {(Object.keys(FILTER_LABELS) as (keyof JourneyFilters)[]).map((key) => (
          <div key={key}>
            <p className={cn('mb-1 text-[11px] font-medium', MUTED)}>{FILTER_LABELS[key]}</p>
            <Select value={filters[key] ?? ALL} onValueChange={set(key)}>
              <SelectTrigger className="h-8 text-xs" aria-label={FILTER_LABELS[key]}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {choices[key]?.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
        {active > 0 && <Button variant="ghost" size="sm" className="h-8 w-full text-xs" onClick={() => onChange({})}>Clear all filters</Button>}
      </PopoverContent>
    </Popover>
  )
}

/** What is currently applied, one click each to remove — so a filtered page never looks like missing data. */
function ActiveFilterChips({
  projectId, campaignId, filters, onChange,
}: Readonly<{ projectId: string; campaignId: string; filters: JourneyFilters; onChange: (f: JourneyFilters) => void }>) {
  const choices = useFilterChoices(projectId, campaignId)
  const keys = (Object.keys(FILTER_LABELS) as (keyof JourneyFilters)[]).filter((k) => filters[k])
  if (keys.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {keys.map((k) => (
        <button key={k} type="button" onClick={() => onChange({ ...filters, [k]: undefined })} title="Remove filter"
          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
          {FILTER_LABELS[k]}: <span className="font-medium">{choices[k]?.find((c) => c.value === filters[k])?.label ?? filters[k]}</span>
          <X className="h-3 w-3" />
        </button>
      ))}
      <button type="button" onClick={() => onChange({})} className={cn('text-xs underline-offset-2 hover:underline', MUTED)}>Clear all</button>
    </div>
  )
}

/** "Copied" flashes for 1.5s — shared by every code-snippet block on this page. */
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return { copied, copy }
}

function CodeBlock({ code }: Readonly<{ code: string }>) {
  const { copied, copy } = useCopyToClipboard()
  return (
    <div className="relative">
      <pre className="max-h-64 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">{code}</pre>
      <button
        onClick={() => copy(code)}
        className="absolute right-2 top-2 rounded-md border border-gray-700 bg-gray-800 p-1.5 text-gray-300 hover:bg-gray-700"
        title="Copy"
        aria-label="Copy snippet"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

const code = 'rounded bg-gray-100 px-1 dark:bg-gray-800'

function IntegrationDocs({ campaignKey }: Readonly<{ campaignKey: string }>) {
  const snippet = String.raw`curl -X POST https://<your-domain>/api/journeys/events \
  -H "Content-Type: application/json" \
  -H "x-pype-token: <YOUR_PYPE_TOKEN>" \
  -d '{
    "campaign_key": "${campaignKey}",
    "identity_key": "<your own member/lead id, e.g. member_id>",
    "channel": "whatsapp",
    "step": "<your own step name, e.g. current_step>",
    "action": "message_sent",
    "payload": { "delivery_status": "delivered", "reachout_count": 2 }
  }'`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <FileCode2 className="h-3.5 w-3.5" /> Integration
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px]">
        <p className={cn('mb-1 text-sm font-medium', INK)}>Send events to this campaign</p>
        <p className={cn('mb-3 text-xs', MUTED)}>
          Any workflow can post a step for a journey — a new <code className={code}>identity_key</code> starts one automatically. Required:{' '}
          <code className={code}>campaign_key</code>, <code className={code}>identity_key</code>, <code className={code}>channel</code>,{' '}
          <code className={code}>step</code>, <code className={code}>action</code>. <code className={code}>step</code> and{' '}
          <code className={code}>channel</code> are free text — reuse the names your system already has. Anything else you track goes in{' '}
          <code className={code}>payload</code>, stored as-is and shown on each journey's timeline. Limits: 8KB per request, 600 requests/min per token.
        </p>
        <CodeBlock code={snippet} />
      </PopoverContent>
    </Popover>
  )
}

/* ───────────────────────────── Empty state ───────────────────────────── */

function EmptyState({ projectId }: Readonly<{ projectId: string }>) {
  const snippet = String.raw`curl -X POST https://<your-domain>/api/journeys/events \
  -H "Content-Type: application/json" \
  -H "x-pype-token: <paste the key from step 1>" \
  -d '{
    "campaign_key": "<pick any name for this campaign, e.g. onboarding>",
    "identity_key": "<your own member/lead id, e.g. member_id>",
    "channel": "whatsapp",
    "step": "<your own step name, e.g. current_step>",
    "action": "message_sent",
    "payload": { "delivery_status": "delivered", "reachout_count": 2 }
  }'`

  const steps: React.ReactNode[] = [
    <>Get a token for this project — open{' '}
      <Link href={`/${projectId}/agents/api-keys`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">Project API Key</Link>{' '}
      and copy it (create one if none exists).</>,
    <>Call the endpoint below with that token. This one call creates the campaign and the journey automatically — nothing to set up beforehand.</>,
    <>Call it again for every later step that same person reaches, reusing the same <code className={code}>campaign_key</code> and{' '}
      <code className={code}>identity_key</code>, changing <code className={code}>step</code>/<code className={code}>action</code> each time.</>,
    <>Come back to this tab — the campaign shows up by its key, with this identity under "Recent journeys."</>,
  ]

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Flag className="h-6 w-6" />
        </span>
        <h2 className={cn('text-lg font-semibold', INK)}>No journeys yet</h2>
        <p className={cn('mt-1 text-sm', MUTED)}>Send your first event and a campaign appears here, with its funnel and timelines.</p>
      </div>
      <ol className={cn(CARD, 'w-full divide-y divide-gray-100 dark:divide-gray-800')}>
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 p-4 text-sm text-gray-700 dark:text-gray-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      <div className="w-full"><CodeBlock code={snippet} /></div>
    </div>
  )
}

/* ───────────────────────────── Section header ───────────────────────────── */

/* ───────────────────────────── KPI row ───────────────────────────── */

function StatTile({
  label, value, sub, icon, loading,
}: Readonly<{ label: string; value: string; sub?: string; icon: React.ReactNode; loading: boolean }>) {
  return (
    <div className={cn(CARD, 'p-4')}>
      <div className={cn('mb-2 flex items-center gap-1.5 text-xs font-medium', MUTED)}>{icon}{label}</div>
      {loading ? (
        <>
          <Skel className="h-8 w-24" />
          <Skel className="mt-2 h-3 w-36" />
        </>
      ) : (
        <>
          <p className={cn('text-3xl font-semibold tabular-nums tracking-tight', INK)}>{value}</p>
          {sub && <p className={cn('mt-1 truncate text-xs', MUTED)} title={sub}>{sub}</p>}
        </>
      )}
    </div>
  )
}

/** The biggest step-over-step loss in the funnel — the number a campaign owner actually acts on. */
function biggestDrop(steps: { label: string; reached_count: number }[]) {
  let best: { index: number; label: string; pct: number } | null = null
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1].reached_count
    if (prev <= 0) continue
    const pct = Math.round(((prev - steps[i].reached_count) / prev) * 100)
    if (pct > 0 && (!best || pct > best.pct)) best = { index: i, label: steps[i].label, pct }
  }
  return best
}

function KpiRow({
  projectId, campaignId, range, filters,
}: Readonly<{ projectId: string; campaignId: string; range: OverviewRange; filters: JourneyFilters }>) {
  const funnel = useFunnel(projectId, campaignId, range, filters, true)
  const active = useActiveJourneys(projectId, campaignId, range, filters, true)
  const steps = funnel.data?.steps ?? []
  const first = steps[0]?.reached_count ?? 0
  const last = steps[steps.length - 1]
  const drop = biggestDrop(steps)
  const peak = active.data?.length ? Math.max(...active.data.map((p) => p.active_count)) : 0
  const avg = active.data?.length ? Math.round(active.data.reduce((s, p) => s + p.active_count, 0) / active.data.length) : 0

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Journeys" icon={<Users className="h-3.5 w-3.5" />} loading={funnel.isLoading}
        value={fmt(funnel.data?.journeyCount ?? 0)} sub="started in this range"
      />
      <StatTile
        label="Reached the final step" icon={<Flag className="h-3.5 w-3.5" />} loading={funnel.isLoading}
        value={first > 0 && last ? `${Math.round((last.reached_count / first) * 100)}%` : '—'}
        sub={last && steps.length > 1 ? `${fmt(last.reached_count)} of ${fmt(first)} reached “${last.label}”` : 'needs 2 or more steps'}
      />
      <StatTile
        label="Biggest drop-off" icon={<TrendingDown className="h-3.5 w-3.5" />} loading={funnel.isLoading}
        value={drop ? `−${drop.pct}%` : '—'}
        sub={drop ? `lost before “${drop.label}”` : 'no drop between steps'}
      />
      <StatTile
        label="Peak daily activity" icon={<Activity className="h-3.5 w-3.5" />} loading={active.isLoading}
        value={fmt(peak)} sub={`${fmt(avg)} on an average day`}
      />
    </div>
  )
}

/* ───────────────────────────── Funnel ───────────────────────────── */

function Funnel({
  projectId, campaignId, range, filters,
}: Readonly<{ projectId: string; campaignId: string; range: OverviewRange; filters: JourneyFilters }>) {
  const { data, isLoading } = useFunnel(projectId, campaignId, range, filters, true)
  const steps = data?.steps ?? []
  const first = steps[0]?.reached_count ?? 0
  const drop = biggestDrop(steps)

  return (
    <div className={cn(CARD, 'h-full p-4')}>
      <div className="mb-4 flex items-baseline justify-between">
        <p className={CARD_TITLE}>Funnel</p>
        <div className={cn('flex items-center gap-3 text-[11px]', MUTED)}>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: 'var(--analytics-series-1)' }} />Reached</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--analytics-series-1) 22%, transparent)' }} />Lost vs previous step</span>
        </div>
      </div>
      {isLoading && <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-7" />)}</div>}
      {!isLoading && steps.length === 0 && <p className={cn('py-8 text-center text-sm', MUTED)}>This campaign has no steps yet.</p>}
      {!isLoading && steps.length > 0 && (
        <ol className="space-y-2.5">
          {steps.map((s, i) => {
            const prev = steps[i - 1]
            const pct = first > 0 ? (s.reached_count / first) * 100 : 0
            const prevPct = prev && first > 0 ? (prev.reached_count / first) * 100 : pct
            const conv = prev && prev.reached_count > 0 ? Math.round((s.reached_count / prev.reached_count) * 100) : null
            const lost = prev ? prev.reached_count - s.reached_count : 0
            const isWorst = drop?.index === i
            return (
              <li
                key={s.step_key}
                className="group grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-0.5 transition hover:bg-gray-50 dark:hover:bg-gray-800/50 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_5.5rem_6.5rem]"
                title={`${s.label}: ${fmt(s.reached_count)} reached${prev ? ` · ${fmt(lost)} lost vs “${prev.label}”` : ''}`}
              >
                <span className="flex items-center gap-2 truncate text-xs text-gray-700 dark:text-gray-300">
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300')}>{i + 1}</span>
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="relative block h-7 overflow-hidden rounded-md bg-gray-100/70 dark:bg-gray-800/60">
                  {prev && prevPct > pct && (
                    <span className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${prevPct}%`, backgroundColor: 'color-mix(in srgb, var(--analytics-series-1) 22%, transparent)' }} />
                  )}
                  <span className="absolute inset-y-0 left-0 rounded-md transition-all" style={{ width: `${Math.max(pct, s.reached_count > 0 ? 1.5 : 0)}%`, backgroundColor: 'var(--analytics-series-1)' }} />
                </span>
                <span className={cn('hidden text-right text-sm font-semibold tabular-nums sm:block', INK)}>{fmt(s.reached_count)}</span>
                <span className="text-right text-xs tabular-nums">
                  <span className={MUTED}>{conv === null ? `${Math.round(pct)}%` : `${conv}% of prev`}</span>
                  {isWorst && <span className={cn('mt-0.5 flex items-center justify-end gap-0.5 text-[10px] font-medium', INK)}><TrendingDown className="h-3 w-3" />largest drop</span>}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/* ───────────────────────────── Activity trend ───────────────────────────── */

function ActiveJourneysChart({
  projectId, campaignId, range, filters,
}: Readonly<{ projectId: string; campaignId: string; range: OverviewRange; filters: JourneyFilters }>) {
  const { data: points, isLoading } = useActiveJourneys(projectId, campaignId, range, filters, true)

  return (
    <div className={cn(CARD, 'flex h-full min-h-[260px] flex-col p-4')}>
      <p className={cn('mb-3', CARD_TITLE)}>Active journeys per day</p>
      <div className="min-h-0 flex-1">
        {isLoading && <Skel className="h-full" />}
        {!isLoading && (!points || points.length === 0) && <div className={cn('flex h-full items-center justify-center text-sm', MUTED)}>No activity in this range.</div>}
        {!isLoading && points && points.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="journey-active-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--analytics-series-1)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--analytics-series-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className={GRID_STROKE} vertical={false} />
              <XAxis dataKey="day" tickFormatter={(d: string) => formatBucket(d, 'day')} tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: 'currentColor', strokeOpacity: 0.25, strokeDasharray: '3 3' }}
                content={<ChartTooltip valueName="Active journeys" labelFormatter={(d) => formatBucket(d, 'day')} />}
              />
              <Area type="monotone" dataKey="active_count" name="Active journeys" stroke="var(--analytics-series-1)" strokeWidth={2} fill="url(#journey-active-fill)" activeDot={{ r: 4, strokeWidth: 2, className: 'stroke-white dark:stroke-gray-900' }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

/* ───────────────────────────── Chart builder ───────────────────────────── */

type BuiltChart = SavedChart

const BAR_MAX = 10

/** Charts used to live only in this browser; they're imported into the database the first time a campaign opens. */
function localChartsKey(campaignId: string): string {
  return `whispey:journey-charts:${campaignId}`
}

function loadLocalCharts(campaignId: string): Omit<SavedChart, 'id'>[] {
  try {
    const raw = JSON.parse(localStorage.getItem(localChartsKey(campaignId)) ?? '[]')
    return Array.isArray(raw)
      ? raw.filter((c) => c?.dimension && (c.metric === 'events' || c.metric === 'journeys') && ['bar', 'line', 'pie'].includes(c.kind))
          .slice(0, 30).map((c) => ({ dimension: String(c.dimension), metric: c.metric, kind: c.kind }))
      : []
  } catch {
    return []
  }
}

function clearLocalCharts(campaignId: string) {
  try {
    localStorage.removeItem(localChartsKey(campaignId))
  } catch {
    // storage disabled — nothing to clear
  }
}

/**
 * Keeps the biggest groups. Event counts add up, so the tail folds into "Other";
 * distinct-journey counts do NOT (one journey can sit in several groups), so the
 * tail is dropped and reported instead of summed into a misleading total.
 */
function topN(points: CustomChartPoint[], max: number, metric: ChartMetric) {
  const sorted = [...points].sort((a, b) => b.value - a.value)
  if (sorted.length <= max) return { shown: sorted, hidden: 0 }
  if (metric === 'events') {
    const other = sorted.slice(max - 1).reduce((s, p) => s + p.value, 0)
    return { shown: [...sorted.slice(0, max - 1), { bucket: 'Other', value: other }], hidden: 0 }
  }
  return { shown: sorted.slice(0, max), hidden: sorted.length - max }
}

function ChartCard({
  chart, dimensionLabel, projectId, campaignId, range, filters, readOnly, onChangeKind, onRemove,
}: Readonly<{
  chart: BuiltChart; dimensionLabel: string; projectId: string; campaignId: string
  range: OverviewRange; filters: JourneyFilters; readOnly: boolean; onChangeKind: (k: ChartKind) => void; onRemove: () => void
}>) {
  const { data: points, isLoading } = useCustomChart(projectId, campaignId, chart.dimension, chart.metric, range, filters, true)
  const [asTable, setAsTable] = useState(false)
  const isTime = chart.dimension === '__time__'
  const kind: ChartKind = isTime ? 'line' : chart.kind
  const metricLabel = chart.metric === 'journeys' ? 'Distinct journeys' : 'Events'

  const { shown, hidden } = useMemo(() => {
    if (!points) return { shown: [] as CustomChartPoint[], hidden: 0 }
    if (isTime) return { shown: [...points].sort((a, b) => a.bucket.localeCompare(b.bucket)), hidden: 0 }
    return topN(points, kind === 'pie' ? PIE_MAX_SLICES : BAR_MAX, chart.metric)
  }, [points, isTime, kind, chart.metric])
  const total = shown.reduce((s, p) => s + p.value, 0)
  const labelFor = (x: string) => (isTime ? formatBucket(x, 'day') : x)

  return (
    <div className={cn(CARD, 'flex h-80 flex-col p-4')}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('truncate', CARD_TITLE)}>{metricLabel} by {dimensionLabel}</p>
          {!isLoading && points && points.length > 0 && <p className={cn('text-[11px] tabular-nums', MUTED)}>{chart.metric === 'journeys' && !isTime ? `Top ${shown.length}` : `Total ${fmt(total)}`}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!isTime && !readOnly && (
            <Segmented<ChartKind>
              label="Chart type" iconOnly value={kind} onChange={onChangeKind}
              options={[
                { value: 'bar', label: 'Bar', icon: <BarChart3 className="h-3.5 w-3.5" /> },
                { value: 'pie', label: 'Pie', icon: <PieChartIcon className="h-3.5 w-3.5" /> },
                { value: 'line', label: 'Line', icon: <LineChartIcon className="h-3.5 w-3.5" /> },
              ]}
            />
          )}
          <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} title="View as table" aria-label="View as table"
            className={cn('rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200', asTable && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200')}>
            <Table2 className="h-4 w-4" />
          </button>
          {!readOnly && (
            <button type="button" onClick={onRemove} title="Remove chart" aria-label="Remove chart" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {isLoading && <Skel className="h-full" />}
        {!isLoading && shown.length === 0 && <div className={cn('flex h-full items-center justify-center text-sm', MUTED)}>No data in this range.</div>}

        {!isLoading && shown.length > 0 && asTable && (
          <div className="h-full overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className={cn('border-b border-gray-200 text-left dark:border-gray-800', MUTED)}><th className="py-1.5 font-medium">{dimensionLabel}</th><th className="py-1.5 text-right font-medium">{metricLabel}</th><th className="py-1.5 text-right font-medium">Share</th></tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.bucket} className="border-b border-gray-100 last:border-0 dark:border-gray-800/70">
                    <td className={cn('max-w-[10rem] truncate py-1.5', INK)} title={labelFor(p.bucket)}>{labelFor(p.bucket)}</td>
                    <td className={cn('py-1.5 text-right tabular-nums', INK)}>{fmt(p.value)}</td>
                    <td className={cn('py-1.5 text-right tabular-nums', MUTED)}>{total ? Math.round((p.value / total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hidden > 0 && <p className={cn('mt-2 text-[11px]', MUTED)}>+{hidden} more groups not shown</p>}
          </div>
        )}

        {!isLoading && shown.length > 0 && !asTable && kind === 'pie' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={shown} dataKey="value" nameKey="bucket" innerRadius="52%" outerRadius="80%" paddingAngle={2} stroke="none">
                {shown.map((p, i) => <Cell key={p.bucket} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip valueName={metricLabel} total={total} />} />
              <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(v: unknown) => <span className={cn('text-[11px]', MUTED)} title={String(v)}>{shortLabel(String(v), 16)}</span>} />
            </PieChart>
          </ResponsiveContainer>
        )}

        {!isLoading && shown.length > 0 && !asTable && kind === 'bar' && !isTime && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shown} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }} barCategoryGap={6}>
              <CartesianGrid strokeDasharray="3 3" className={GRID_STROKE} horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="bucket" width={112} tick={AXIS} tickLine={false} axisLine={false} interval={0} tickFormatter={(x: string) => shortLabel(x, 16)} />
              <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} content={<ChartTooltip valueName={metricLabel} total={total} />} />
              <Bar dataKey="value" name={metricLabel} fill="var(--analytics-series-1)" radius={[0, 4, 4, 0]} maxBarSize={22}>
                <LabelList dataKey="value" position="right" formatter={(v: unknown) => fmt(Number(v))} className="fill-gray-500 text-[11px] dark:fill-gray-400" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {!isLoading && shown.length > 0 && !asTable && kind === 'line' && (
          <ResponsiveContainer width="100%" height="100%">
            {isTime ? (
              <AreaChart data={shown} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id={`fill-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--analytics-series-1)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--analytics-series-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className={GRID_STROKE} vertical={false} />
                <XAxis dataKey="bucket" tickFormatter={(x: string) => formatBucket(x, 'day')} tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                <Tooltip cursor={{ stroke: 'currentColor', strokeOpacity: 0.25, strokeDasharray: '3 3' }} content={<ChartTooltip valueName={metricLabel} labelFormatter={(l) => formatBucket(l, 'day')} />} />
                <Area type="monotone" dataKey="value" name={metricLabel} stroke="var(--analytics-series-1)" strokeWidth={2} fill={`url(#fill-${chart.id})`} activeDot={{ r: 4, strokeWidth: 2, className: 'stroke-white dark:stroke-gray-900' }} />
              </AreaChart>
            ) : (
              <LineChart data={shown} margin={{ top: 6, right: 8, left: -14, bottom: 36 }}>
                <CartesianGrid strokeDasharray="3 3" className={GRID_STROKE} vertical={false} />
                <XAxis dataKey="bucket" tickFormatter={(x: string) => shortLabel(x, 12)} tick={AXIS} tickLine={false} axisLine={false} interval={0} angle={-35} textAnchor="end" height={56} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                <Tooltip cursor={{ stroke: 'currentColor', strokeOpacity: 0.25, strokeDasharray: '3 3' }} content={<ChartTooltip valueName={metricLabel} total={total} />} />
                <Line type="monotone" dataKey="value" name={metricLabel} stroke="var(--analytics-series-1)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      {!isLoading && hidden > 0 && !asTable && <p className={cn('mt-1 text-[11px]', MUTED)}>Showing the top {shown.length} of {shown.length + hidden} groups</p>}
    </div>
  )
}

const PRESETS: { label: string; dimension: string; metric: ChartMetric; kind: ChartKind }[] = [
  { label: 'Journeys by step', dimension: 'step', metric: 'journeys', kind: 'bar' },
  { label: 'Events by channel', dimension: 'channel', metric: 'events', kind: 'pie' },
  { label: 'Journeys by outcome', dimension: 'outcome', metric: 'journeys', kind: 'bar' },
  { label: 'Events over time', dimension: '__time__', metric: 'events', kind: 'line' },
]

function CustomChartBuilder({
  projectId, campaignId, range, filters,
}: Readonly<{ projectId: string; campaignId: string; range: OverviewRange; filters: JourneyFilters }>) {
  const { data: dimensions } = useChartDimensions(projectId, campaignId, true)
  const [draftDimension, setDraftDimension] = useState('channel')
  const [draftMetric, setDraftMetric] = useState<ChartMetric>('events')
  const [draftKind, setDraftKind] = useState<ChartKind>('bar')
  const [builderOpen, setBuilderOpen] = useState(false)
  const saved = useJourneyCharts(projectId, campaignId, true)
  const { charts, canEdit } = saved
  const importedFor = useRef<string | null>(null)

  // one-time: move this browser's old local charts into the database, then forget them locally
  useEffect(() => {
    if (saved.isLoading || !canEdit || importedFor.current === campaignId) return
    importedFor.current = campaignId
    const local = loadLocalCharts(campaignId)
    if (local.length === 0) return
    if (saved.charts.length === 0) saved.add(local, { onSuccess: () => clearLocalCharts(campaignId) })
    else clearLocalCharts(campaignId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, saved.isLoading, canEdit])

  const isTime = draftDimension === '__time__'
  const dimensionLabel = (key: string) => dimensions?.find((d) => d.key === key)?.label ?? key
  const presets = PRESETS.filter((p) => dimensions?.some((d) => d.key === p.dimension))
  const add = (c: Omit<BuiltChart, 'id'>) => saved.add([c])

  return (
    <div className="space-y-4">
      {saved.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{saved.error}</p>}

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {presets.length > 0 && <span className={cn('text-xs', MUTED)}>Quick add</span>}
            {presets.map((p) => (
              <button key={p.label} type="button" disabled={saved.adding} onClick={() => add(p)} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-800 dark:hover:text-blue-400">
                + {p.label}
              </button>
            ))}
          </div>
          <Popover open={builderOpen} onOpenChange={setBuilderOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> New chart</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <div>
                <p className={cn('mb-1 text-[11px] font-medium', MUTED)}>Break down by</p>
                <Select value={draftDimension} onValueChange={setDraftDimension}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{(dimensions ?? []).map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className={cn('mb-1 text-[11px] font-medium', MUTED)}>Measure</p>
                <Segmented<ChartMetric> label="Measure" value={draftMetric} onChange={setDraftMetric} options={[{ value: 'events', label: 'Events' }, { value: 'journeys', label: 'Distinct journeys' }]} />
              </div>
              {!isTime && (
                <div>
                  <p className={cn('mb-1 text-[11px] font-medium', MUTED)}>Chart</p>
                  <Segmented<ChartKind>
                    label="Chart type" value={draftKind} onChange={setDraftKind}
                    options={[
                      { value: 'bar', label: 'Bar', icon: <BarChart3 className="h-3.5 w-3.5" /> },
                      { value: 'pie', label: 'Pie', icon: <PieChartIcon className="h-3.5 w-3.5" /> },
                      { value: 'line', label: 'Line', icon: <LineChartIcon className="h-3.5 w-3.5" /> },
                    ]}
                  />
                </div>
              )}
              <Button size="sm" className="h-8 w-full gap-1.5 text-xs" disabled={!dimensions || saved.adding}
                onClick={() => { add({ dimension: draftDimension, metric: draftMetric, kind: isTime ? 'line' : draftKind }); setBuilderOpen(false) }}>
                {saved.adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add to this campaign
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {saved.isLoading ? (
        <Skel className="h-48" />
      ) : charts.length === 0 ? (
        <div className={cn(CARD, 'flex flex-col items-center gap-1 border-dashed py-12 text-center')}>
          <BarChart3 className="h-6 w-6 text-gray-300 dark:text-gray-600" />
          <p className={cn('text-sm font-medium', INK)}>No charts yet</p>
          <p className={cn('max-w-sm text-xs', MUTED)}>{canEdit ? 'Tap a quick-add suggestion above or create your own with New chart. Charts are saved for everyone on this project.' : 'Nobody has added a chart to this campaign yet.'}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {charts.map((c) => (
            <ChartCard
              key={c.id} chart={c} dimensionLabel={dimensionLabel(c.dimension)}
              projectId={projectId} campaignId={campaignId} range={range} filters={filters} readOnly={!canEdit}
              onChangeKind={(kind) => saved.changeKind(c.id, kind)}
              onRemove={() => saved.remove(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────────── Journeys list + timeline drawer ───────────────────────────── */

type StepDef = { step: string; label: string }

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const tone = /complet|success|won|convert|done|resolved/i.test(status) ? 'bg-emerald-500'
    : /fail|drop|lost|cancel|error|stuck|expired|exhaust/i.test(status) ? 'bg-red-500'
    : /active|progress|running|pending|open/i.test(status) ? 'bg-blue-500'
    : 'bg-gray-400'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300">
      <span className={cn('h-1.5 w-1.5 rounded-full', tone)} />
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function callHref(projectId: string, e: JourneyEvent): string | null {
  return e.agent_id && e.external_ref && (e.channel === 'voice' || e.action.startsWith('call_'))
    ? `/${projectId}/agents/${e.agent_id}/observability?session_id=${e.external_ref}`
    : null
}

/** How far a member got along the campaign's steps — one glance per row instead of a wall of chips. */
function StepProgress({ steps, events }: Readonly<{ steps: StepDef[]; events: JourneyEvent[] }>) {
  const flow = steps.filter((s) => s.step !== 'joined')
  const reached = new Set(events.map((e) => e.step).filter(Boolean))
  let furthest = -1
  flow.forEach((s, i) => { if (reached.has(s.step)) furthest = i })
  const label = furthest >= 0 ? flow[furthest].label : 'Joined, no step yet'
  return (
    <span className="block min-w-0" title={flow.map((s) => `${reached.has(s.step) ? '✓' : '·'} ${s.label}`).join('\n')}>
      <span className="flex items-center gap-1">
        {flow.map((s, i) => (
          <span key={s.step} className={cn('h-1.5 flex-1 rounded-full', reached.has(s.step) ? 'bg-blue-500' : i < furthest ? 'bg-blue-200 dark:bg-blue-900/70' : 'bg-gray-200 dark:bg-gray-700')} />
        ))}
      </span>
      <span className={cn('mt-1 block truncate text-[11px]', MUTED)}>{label}</span>
    </span>
  )
}

const ACTION_LABEL: Record<string, string> = {
  entered_campaign: 'Joined the campaign', message_sent: 'WhatsApp sent', message_delivered: 'WhatsApp delivered', message_read: 'WhatsApp read',
  message_failed: 'WhatsApp failed', link_clicked: 'Clicked the form link', call_completed: 'Call answered', call_not_connected: 'Call not connected',
  campaign_exhausted: 'Finished: no more attempts', status_changed: 'Status changed', family_member_added: 'Family member added', converted: 'Converted',
}
const actionLabel = (a: string) => ACTION_LABEL[a] ?? a.replace(/_/g, ' ')

function EventIcon({ e }: Readonly<{ e: JourneyEvent }>) {
  const cls = 'h-3.5 w-3.5'
  if (e.action === 'call_not_connected') return <PhoneMissed className={cls} />
  if (e.action.startsWith('call_')) return <Phone className={cls} />
  if (e.action === 'family_member_added' || e.action === 'converted') return <UserPlus className={cls} />
  if (e.channel === 'whatsapp') return <MessageCircle className={cls} />
  return <Flag className={cls} />
}

const DETAIL_KEYS = ['call_ended_reason', 'duration_seconds', 'final_disposition', 'template', 'relation', 'age', 'disposition', 'to_status']

type EventFilter = 'all' | 'messages' | 'calls' | 'other'
const matchesFilter = (e: JourneyEvent, f: EventFilter) =>
  f === 'all' || (f === 'calls' ? e.action.startsWith('call_') : f === 'messages' ? e.channel === 'whatsapp' : e.channel !== 'whatsapp' && !e.action.startsWith('call_'))

function Timeline({ projectId, events, steps }: Readonly<{ projectId: string; events: JourneyEvent[]; steps: StepDef[] }>) {
  const stepLabel = (k: string | null) => steps.find((s) => s.step === k)?.label ?? k
  const groups = useMemo(() => {
    const out: { day: string; items: JourneyEvent[] }[] = []
    for (const e of events) {
      const day = new Date(e.occurred_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
      const last = out[out.length - 1]
      if (last?.day === day) last.items.push(e)
      else out.push({ day, items: [e] })
    }
    return out
  }, [events])

  if (events.length === 0) return <p className={cn('py-8 text-center text-sm', MUTED)}>No events of this kind.</p>
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.day}>
          <p className={cn('mb-2 text-[11px] font-semibold uppercase tracking-wider', MUTED)}>{g.day}</p>
          <ol className="space-y-3 border-l border-gray-200 pl-4 dark:border-gray-800">
            {g.items.map((e, i) => {
              const href = callHref(projectId, e)
              const details = e.payload ? DETAIL_KEYS.filter((k) => e.payload![k] !== undefined && e.payload![k] !== null && e.payload![k] !== '') : []
              const bad = e.action === 'call_not_connected' || e.action === 'message_failed'
              return (
                <li key={i} className="relative">
                  <span className={cn('absolute -left-[26px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white dark:border-gray-900', bad ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300')}>
                    <EventIcon e={e} />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn('text-sm font-medium', INK)}>{actionLabel(e.action)}</span>
                    <span className={cn('text-xs tabular-nums', MUTED)}>{new Date(e.occurred_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                    {href && <Link href={href} target="_blank" className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">Open call <ExternalLink className="h-3 w-3" /></Link>}
                  </div>
                  {(e.step || details.length > 0) && (
                    <p className={cn('mt-0.5 text-xs', MUTED)}>
                      {[e.step ? stepLabel(e.step) : null, ...details.map((k) => `${k.replace(/_/g, ' ')}: ${String(e.payload![k]).replace(/_/g, ' ')}`)].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}

function JourneyDrawer({
  projectId, journey, steps, onClose,
}: Readonly<{ projectId: string; journey: JourneySummary | null; steps: StepDef[]; onClose: () => void }>) {
  const [filter, setFilter] = useState<EventFilter>('all')
  useEffect(() => setFilter('all'), [journey?.id])
  const events = useMemo(() => journey?.events ?? [], [journey])
  const shown = useMemo(() => events.filter((e) => matchesFilter(e, filter)), [events, filter])
  const count = (f: (e: JourneyEvent) => boolean) => events.filter(f).length

  return (
    <Sheet open={!!journey} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {journey && (
          <>
            <SheetHeader>
              <SheetTitle className="break-all pr-6 text-base">{journey.identity_key}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={journey.status} />
                  {journey.outcome && <span className={cn('text-xs', MUTED)}>{journey.outcome.replace(/_/g, ' ')}</span>}
                  <span className={cn('text-xs', MUTED)}>started {new Date(journey.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <StepProgress steps={steps} events={events} />
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Messages', value: count((e) => e.action === 'message_sent') },
                  { label: 'Call attempts', value: count((e) => e.action.startsWith('call_')) },
                  { label: 'Calls answered', value: count((e) => e.action === 'call_completed') },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg border border-gray-200 py-2 dark:border-gray-800">
                    <p className={cn('text-lg font-semibold tabular-nums', INK)}>{k.value}</p>
                    <p className={cn('text-[11px]', MUTED)}>{k.label}</p>
                  </div>
                ))}
              </div>
              <Segmented<EventFilter>
                label="Show" value={filter} onChange={setFilter}
                options={[{ value: 'all', label: `All ${events.length}` }, { value: 'messages', label: 'Messages' }, { value: 'calls', label: 'Calls' }, { value: 'other', label: 'Other' }]}
              />
              <Timeline projectId={projectId} events={shown} steps={steps} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function RecentJourneys({
  projectId, steps, journeys, isLoading, isFetching, currentPage, isFirstPage, isLastPage, goToNextPage, goToPrevPage,
}: Readonly<{
  projectId: string; steps: StepDef[]; journeys: JourneySummary[]; isLoading: boolean; isFetching: boolean; currentPage: number
  isFirstPage: boolean; isLastPage: boolean; goToNextPage: () => void; goToPrevPage: () => void
}>) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? journeys.filter((j) => j.identity_key.toLowerCase().includes(q)) : journeys
  }, [journeys, query])
  const open = journeys.find((j) => j.id === openId) ?? null

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-xs', MUTED)}>Most recently active first. Select a journey to see everything that happened to that member.</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a member on this page…" aria-label="Find a member on this page"
            className="h-8 w-60 rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-xs outline-none placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
      </div>
      <div className={cn(CARD, 'overflow-hidden')}>
        <div className={cn('hidden grid-cols-[minmax(0,12rem)_minmax(0,1fr)_9rem_5rem] gap-4 border-b border-gray-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider dark:border-gray-800 md:grid', MUTED)}>
          <span>Member</span><span>Progress</span><span>Status</span><span className="text-right">Active</span>
        </div>
        {isLoading && <div className="space-y-px p-3">{Array.from({ length: 8 }, (_, i) => <Skel key={i} className="h-12" />)}</div>}
        {!isLoading && journeys.length === 0 && <div className={cn('flex h-40 items-center justify-center text-sm', MUTED)}>No journeys for this campaign yet.</div>}
        {!isLoading && journeys.length > 0 && visible.length === 0 && <div className={cn('flex h-40 items-center justify-center text-sm', MUTED)}>No member on this page matches “{query}”.</div>}
        {!isLoading && visible.length > 0 && (
          <ul>
            {visible.map((j) => (
              <li key={j.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800/70">
                <button type="button" onClick={() => setOpenId(j.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/40 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_9rem_5rem]">
                  <span className={cn('truncate text-sm font-medium', INK)} title={j.identity_key}>{j.identity_key}</span>
                  <span className="order-last col-span-2 md:order-none md:col-span-1"><StepProgress steps={steps} events={j.events} /></span>
                  <span className="flex flex-col items-start gap-1"><StatusBadge status={j.status} />{j.outcome && <span className={cn('max-w-full truncate text-[11px]', MUTED)} title={j.outcome}>{j.outcome.replace(/_/g, ' ')}</span>}</span>
                  <span className={cn('hidden text-right text-xs tabular-nums md:block', MUTED)} title={new Date(j.updated_at).toLocaleString()}>{timeAgo(j.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className={cn('text-xs', MUTED)}>{journeys.length > 0 ? `Page ${currentPage}` : ''}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={isFirstPage || isLoading} onClick={goToPrevPage}><ChevronLeft className="h-4 w-4" /> Previous</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={isLastPage || isFetching} onClick={goToNextPage}>
            Next {isFetching && !isLastPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <JourneyDrawer projectId={projectId} journey={open} steps={steps} onClose={() => setOpenId(null)} />
    </section>
  )
}

/* ───────────────────────────── Page ───────────────────────────── */

type View = 'overview' | 'charts' | 'journeys'
const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'Numbers, funnel and activity' },
  { id: 'charts', label: 'Charts', hint: 'Your own breakdowns' },
  { id: 'journeys', label: 'Journeys', hint: 'Every member, one by one' },
]
const VIEW_KEY = 'whispey:journeys-view'

export function JourneysTab({ projectId, isActive }: Readonly<{ projectId: string; isActive: boolean }>) {
  const { data: campaigns, isLoading: campaignsLoading, error: campaignsError, refetch: refetchCampaigns } = useCampaigns(projectId, isActive)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [range, setRange] = useState<OverviewRange>({ days: 30 })
  const [filters, setFilters] = useState<JourneyFilters>({})
  const [view, setView] = useState<View>('overview')
  const recent = useRecentJourneys(projectId, campaignId, filters, isActive && view === 'journeys')
  const campaign = campaigns?.find((c) => c.id === campaignId)

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY)
      if (v === 'overview' || v === 'charts' || v === 'journeys') setView(v)
    } catch {
      // storage unavailable — start on Overview
    }
  }, [])
  const changeView = (v: View) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* not fatal */ }
  }

  // filter options are per-campaign — a filter picked for one campaign is meaningless on another
  const handleCampaignChange = (id: string) => {
    setCampaignId(id)
    setFilters({})
    recent.resetPage()
  }

  const handleFiltersChange = (f: JourneyFilters) => {
    setFilters(f)
    recent.resetPage()
  }

  useEffect(() => {
    if (!campaignId && campaigns && campaigns.length > 0) setCampaignId(campaigns[0].id)
  }, [campaigns, campaignId])

  if (campaignsLoading) {
    return (
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-8">
          <Skel className="h-24" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skel key={i} className="h-24" />)}</div>
          <Skel className="h-72" />
        </div>
      </div>
    )
  }

  if (campaignsError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
        <div className={cn(CARD, 'max-w-md p-6 text-center')}>
          <p className={cn('text-sm font-semibold', INK)}>Couldn't load journeys</p>
          <p className={cn('mt-1 text-xs', MUTED)}>{campaignsError instanceof Error ? campaignsError.message : 'Something went wrong.'} This is a loading problem, not missing data. Nothing was deleted.</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => refetchCampaigns()}>Try again</Button>
        </div>
      </div>
    )
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <EmptyState projectId={projectId} />
      </div>
    )
  }

  const steps: StepDef[] = campaign?.steps ?? []

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 pt-3">
            <div className="flex min-w-0 items-center gap-3">
              <Select value={campaignId ?? undefined} onValueChange={handleCampaignChange}>
                <SelectTrigger className="h-9 w-64 text-sm font-medium" aria-label="Campaign"><SelectValue placeholder="Select a campaign" /></SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name ?? c.key}</SelectItem>)}
                </SelectContent>
              </Select>
              {campaign && <span className={cn('hidden text-xs lg:block', MUTED)}>{campaign.steps.length} steps</span>}
            </div>
            <div className="flex items-center gap-2">
              <RangePicker range={range} onChange={setRange} />
              {campaignId && <FiltersPopover projectId={projectId} campaignId={campaignId} filters={filters} onChange={handleFiltersChange} />}
              {campaign && <IntegrationDocs campaignKey={campaign.key} />}
            </div>
          </div>
          <nav className="-mb-px flex gap-1" aria-label="Journeys sections">
            {VIEWS.map((v) => (
              <button
                key={v.id} type="button" onClick={() => changeView(v.id)} title={v.hint} aria-current={view === v.id ? 'page' : undefined}
                className={cn(
                  'border-b-2 px-3 py-2 text-sm transition',
                  view === v.id ? 'border-blue-600 font-medium text-gray-900 dark:border-blue-400 dark:text-gray-50' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                )}
              >
                {v.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {campaignId && (
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-8">
          <ActiveFilterChips projectId={projectId} campaignId={campaignId} filters={filters} onChange={handleFiltersChange} />

          {view === 'overview' && (
            <div className="space-y-4">
              <KpiRow projectId={projectId} campaignId={campaignId} range={range} filters={filters} />
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3"><Funnel projectId={projectId} campaignId={campaignId} range={range} filters={filters} /></div>
                <div className="lg:col-span-2"><ActiveJourneysChart projectId={projectId} campaignId={campaignId} range={range} filters={filters} /></div>
              </div>
            </div>
          )}

          {view === 'charts' && <CustomChartBuilder projectId={projectId} campaignId={campaignId} range={range} filters={filters} />}

          {view === 'journeys' && (
            <RecentJourneys
              projectId={projectId} steps={steps} journeys={recent.journeys} isLoading={recent.isLoading} isFetching={recent.isFetching}
              currentPage={recent.currentPage} isFirstPage={recent.isFirstPage} isLastPage={recent.isLastPage}
              goToNextPage={recent.goToNextPage} goToPrevPage={recent.goToPrevPage}
            />
          )}
        </div>
      )}
    </div>
  )
}
