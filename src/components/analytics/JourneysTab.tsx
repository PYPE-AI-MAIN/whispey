/**
 * Journeys tab — Confluence "Analytics Phase 3 and 4 — Build Spec" §3.5.3.
 * A campaign selector, its funnel, and the most recently updated journeys as
 * milestone chips. Only exists in the org view (§3.5.4) — a per-agent canvas
 * has nothing cross-agent to show.
 *
 * Campaigns and journeys are created implicitly by `ingest_journey_event`
 * (§3.3.2), so the only real state here is "no campaign has sent an event
 * yet" — not an error, just nothing to show.
 */
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, Copy, FileCode2, Loader2, Plus, X } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatBucket, shortLabel } from './chartData'
import { SERIES_COLORS } from './ChartRenderer'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { RangePicker } from './OrgOverview'
import {
  RECENT_JOURNEYS_PAGE_SIZE,
  useActiveJourneys,
  useCampaigns,
  useChartDimensions,
  useCustomChart,
  useFunnel,
  useJourneyFilterOptions,
  useRecentJourneys,
  type ChartMetric,
  type JourneyEvent,
  type JourneyFilters,
  type JourneySummary,
} from '@/hooks/useJourneys'
import type { OverviewRange } from '@/hooks/useOrgOverview'

const ALL = '__all__'

/**
 * §3.6.3's Channel / Outcome-status / Agent filters. Options are real values
 * seen for this campaign (`useJourneyFilterOptions`), not a fixed enum — any
 * source can send any channel or outcome string (§3.3).
 */
function FilterBar({
  projectId,
  campaignId,
  filters,
  onChange,
}: Readonly<{ projectId: string; campaignId: string; filters: JourneyFilters; onChange: (f: JourneyFilters) => void }>) {
  const { data: options } = useJourneyFilterOptions(projectId, campaignId, true)
  const { data: agents } = useSupabaseQuery<{ id: string; name: string }>('pype_voice_agents', {
    select: 'id, name',
    filters: [{ column: 'project_id', operator: 'eq', value: projectId }],
  })

  const set = (key: keyof JourneyFilters) => (value: string) => onChange({ ...filters, [key]: value === ALL ? undefined : value })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={filters.channel ?? ALL} onValueChange={set('channel')}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Channel" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All channels</SelectItem>
          {options?.channels.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.status ?? ALL} onValueChange={set('status')}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {options?.statuses.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.outcome ?? ALL} onValueChange={set('outcome')}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Outcome" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All outcomes</SelectItem>
          {options?.outcomes.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.agentId ?? ALL} onValueChange={set('agentId')}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Agent" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All agents</SelectItem>
          {agents?.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * How another team wires their workflow up to this campaign — the actual
 * answer to "how do I add my journey," since campaigns/journeys only ever
 * come into existence from an external `POST /api/journeys/events` call
 * (there's nothing to configure in this app first).
 */
/** "Copied" flashes for 1.5s — shared by every code-snippet block on this page instead of each one reimplementing it. */
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return { copied, copy }
}

function IntegrationDocs({ campaignKey }: Readonly<{ campaignKey: string }>) {
  const { copied, copy } = useCopyToClipboard()
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
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileCode2 className="h-3.5 w-3.5" /> Integration
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px]">
        <p className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">Send events to this campaign</p>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Any workflow can post a step for a journey — a new <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">identity_key</code>{' '}
          starts one automatically. Required fields: <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">campaign_key</code>,{' '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">identity_key</code>,{' '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">channel</code>,{' '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">step</code>,{' '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">action</code>. <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">step</code>{' '}
          and <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">channel</code> are free text — reuse whatever names your own system
          already has (e.g. <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">current_step</code>), no migration needed. Anything else
          you already track (delivery status, retry counts, ...) goes in <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">payload</code> —
          it's stored as-is and shown on hover over each journey's milestones. Limits: 8KB per request, 600 requests/min per token.
        </p>
        <div className="relative">
          <pre className="max-h-64 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">{snippet}</pre>
          <button
            onClick={() => copy(snippet)}
            className="absolute right-2 top-2 rounded-md border border-gray-700 bg-gray-800 p-1.5 text-gray-300 hover:bg-gray-700"
            title="Copy"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Title + one-line explanation of what the section below it actually shows — every section gets one, not just the new one. */
function SectionHeader({ title, subtitle }: Readonly<{ title: string; subtitle: string }>) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  )
}

/**
 * Shown when there are zero campaigns — before this, `IntegrationDocs`'s
 * "Integration" button is the only place the actual contract is documented,
 * but that button only exists once a campaign is already selected. Someone
 * starting from exactly zero has nowhere else to find this, so the full
 * curl example goes directly here instead of behind a button with nothing
 * to anchor to yet.
 */
function EmptyState({ projectId }: Readonly<{ projectId: string }>) {
  const { copied, copy } = useCopyToClipboard()
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

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No journeys yet — here's the full setup</p>

      <ol className="w-full space-y-3 text-left text-sm">
        <li className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">1</span>
          <span className="text-gray-700 dark:text-gray-300">
            Get a token for this project — open{' '}
            <Link href={`/${projectId}/agents/api-keys`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              Project API Key
            </Link>{' '}
            and copy it (create one if none exists). Every call below needs it.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</span>
          <span className="text-gray-700 dark:text-gray-300">
            Call the endpoint below with that token. This one call creates the campaign and the journey
            automatically — nothing to set up beforehand.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">3</span>
          <span className="text-gray-700 dark:text-gray-300">
            Call it again for every later step that same person reaches, reusing the same{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">campaign_key</code> and{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">identity_key</code>, changing{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">step</code>/<code className="rounded bg-gray-100 px-1 dark:bg-gray-800">action</code> each
            time — one call per milestone, not a batch.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">4</span>
          <span className="text-gray-700 dark:text-gray-300">Come back to this tab — the campaign shows up by its key, with this identity under "Recent journeys."</span>
        </li>
      </ol>

      <div className="relative w-full text-left">
        <pre className="max-h-64 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">{snippet}</pre>
        <button
          onClick={() => copy(snippet)}
          className="absolute right-2 top-2 rounded-md border border-gray-700 bg-gray-800 p-1.5 text-gray-300 hover:bg-gray-700"
          title="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

/**
 * A row-per-step funnel — the same shape as the "Sent / Delivered / Read"
 * charts messaging dashboards use — instead of a row of disconnected cards.
 * One accent color throughout (matches `ChartRenderer`'s own restraint); the
 * bar length is each step's share of the first step, so the drop-off is
 * legible without a separate badge per step.
 */
function Funnel({
  projectId,
  campaignId,
  range,
  filters,
}: Readonly<{ projectId: string; campaignId: string; range: OverviewRange; filters: JourneyFilters }>) {
  const { data, isLoading } = useFunnel(projectId, campaignId, range, filters, true)
  const steps = data?.steps ?? []
  const first = steps[0]?.reached_count ?? 1

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
  if (steps.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">This campaign has no steps yet.</p>

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-baseline gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
        <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{(data?.journeyCount ?? 0).toLocaleString()}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">total journeys in this range</span>
      </div>
      <div className="space-y-3">
        {steps.map((s, i) => {
          const prev = steps[i - 1]
          const ofFirstPct = first > 0 ? Math.round((s.reached_count / first) * 100) : 0
          // % of journeys that made it from the previous step to this one — the first step has nothing to drop from.
          const stepOverStepPct = i > 0 && prev && prev.reached_count > 0 ? Math.round((s.reached_count / prev.reached_count) * 100) : null

          return (
            <div key={s.step_key} className="flex items-center gap-3">
              <div className="w-32 shrink-0 truncate text-xs text-gray-500 dark:text-gray-400" title={s.label}>{s.label}</div>
              <div className="h-7 flex-1 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-md transition-all"
                  style={{ width: `${Math.max(ofFirstPct, 2)}%`, backgroundColor: 'var(--analytics-series-1)' }}
                />
              </div>
              <div className="w-16 shrink-0 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                {s.reached_count.toLocaleString()}
              </div>
              <div className="w-24 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {stepOverStepPct === null ? `${ofFirstPct}%` : `${stepOverStepPct}% of prev`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Daily distinct-journey count behind the funnel snapshot — the "active people" trend. */
function ActiveJourneysChart({
  projectId,
  campaignId,
  range,
  filters,
}: Readonly<{ projectId: string; campaignId: string; range: OverviewRange; filters: JourneyFilters }>) {
  const { data: points, isLoading } = useActiveJourneys(projectId, campaignId, range, filters, true)

  return (
    <div className="h-56 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {isLoading && (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
      {!isLoading && (!points || points.length === 0) && (
        <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">No activity in this range.</div>
      )}
      {!isLoading && points && points.length > 0 && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => formatBucket(d, 'day')}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid rgb(209 213 219)', fontSize: 12, background: 'rgb(255 255 255)', color: 'rgb(17 24 39)' }}
              labelFormatter={(d: unknown) => formatBucket(String(d), 'day')}
            />
            <Line type="monotone" dataKey="active_count" name="Active journeys" stroke="var(--analytics-series-1)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: '1px solid rgb(209 213 219)', fontSize: 12, background: 'rgb(255 255 255)', color: 'rgb(17 24 39)' },
} as const

/** Module scope, not defined inside CustomChartCard's render — same reasoning as ChartRenderer's own legend formatters. */
function pieLegendLabel(v: unknown) {
  return <span title={String(v)}>{shortLabel(String(v), 18)}</span>
}

/** The angled-label props a category axis needs; a time axis's labels are already short and even, so it gets none. */
function angledTickProps(isTime: boolean) {
  if (isTime) return {}
  return { angle: -35, textAnchor: 'end' as const, height: 56 }
}

type ChartKind = 'bar' | 'line' | 'pie'
type BuiltChart = { id: string; dimension: string; metric: ChartMetric; kind: ChartKind }

/** One built chart — fetches its own data and renders whichever kind was picked for it. */
function CustomChartCard({
  chart, dimensionLabel, projectId, campaignId, range, filters, onRemove,
}: Readonly<{
  chart: BuiltChart; dimensionLabel: string; projectId: string; campaignId: string
  range: OverviewRange; filters: JourneyFilters; onRemove: () => void
}>) {
  const { data: points, isLoading } = useCustomChart(projectId, campaignId, chart.dimension, chart.metric, range, filters, true)
  const isTime = chart.dimension === '__time__'
  const metricLabel = chart.metric === 'journeys' ? 'Journeys' : 'Events'

  return (
    <div className="flex h-72 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{metricLabel} by {dimensionLabel}</p>
        <button onClick={onRemove} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Remove chart">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {isLoading && (
          <div className="flex h-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
        )}
        {!isLoading && (!points || points.length === 0) && (
          <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">No data in this range.</div>
        )}
        {!isLoading && points && points.length > 0 && chart.kind === 'pie' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={points} dataKey="value" nameKey="bucket" innerRadius="45%" outerRadius="78%" paddingAngle={2}>
                {points.map((p, i) => <Cell key={p.bucket} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend formatter={pieLegendLabel} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
        {!isLoading && points && points.length > 0 && chart.kind !== 'pie' && (
          <ResponsiveContainer width="100%" height="100%">
            {chart.kind === 'line' ? (
              <LineChart data={points} margin={{ top: 4, right: 12, left: -12, bottom: isTime ? 4 : 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(x: string) => (isTime ? formatBucket(x, 'day') : shortLabel(x, 12))}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                  {...angledTickProps(isTime)}
                />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip {...tooltipStyle} labelFormatter={(x: unknown) => (isTime ? formatBucket(String(x), 'day') : String(x))} />
                <Line type="monotone" dataKey="value" name={metricLabel} stroke="var(--analytics-series-1)" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={points} margin={{ top: 4, right: 12, left: -12, bottom: isTime ? 4 : 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(x: string) => (isTime ? formatBucket(x, 'day') : shortLabel(x, 12))}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  {...angledTickProps(isTime)}
                />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip {...tooltipStyle} labelFormatter={(x: unknown) => (isTime ? formatBucket(String(x), 'day') : String(x))} />
                <Bar dataKey="value" name={metricLabel} fill="var(--analytics-series-1)" radius={[4, 4, 0, 0]} maxBarSize={64} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

/**
 * Pick a breakdown + metric + chart type, add it, repeat — a small builder
 * scoped to this campaign's own data instead of Explore's shared canvas
 * (which only ever reads `pype_voice_call_logs` and stays untouched by this).
 * Built charts persist per-campaign in localStorage — this browser's layout,
 * not shared team state.
 */
function chartsStorageKey(campaignId: string): string {
  return `whispey:journey-charts:${campaignId}`
}

/** Browser-local only — this is one person's dashboard layout, not shared team state, so localStorage is the right scope rather than a new table. */
function loadSavedCharts(campaignId: string): BuiltChart[] {
  try {
    const raw = localStorage.getItem(chartsStorageKey(campaignId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCharts(campaignId: string, charts: BuiltChart[]) {
  try {
    localStorage.setItem(chartsStorageKey(campaignId), JSON.stringify(charts))
  } catch {
    // private browsing / storage disabled — charts just won't survive a reload, not fatal
  }
}

function CustomChartBuilder({
  projectId, campaignId, range, filters,
}: Readonly<{ projectId: string; campaignId: string; range: OverviewRange; filters: JourneyFilters }>) {
  const { data: dimensions } = useChartDimensions(projectId, campaignId, true)
  const [draftDimension, setDraftDimension] = useState('channel')
  const [draftMetric, setDraftMetric] = useState<ChartMetric>('events')
  const [draftKind, setDraftKind] = useState<ChartKind>('bar')
  const [charts, setCharts] = useState<BuiltChart[]>([])

  // reload from storage whenever the selected campaign changes, not just on first mount
  useEffect(() => {
    setCharts(loadSavedCharts(campaignId))
  }, [campaignId])

  const isTime = draftDimension === '__time__'
  const dimensionLabel = (key: string) => dimensions?.find((d) => d.key === key)?.label ?? key

  const addChart = () => {
    setCharts((c) => {
      const next = [...c, { id: `${Date.now()}`, dimension: draftDimension, metric: draftMetric, kind: isTime ? 'line' as ChartKind : draftKind }]
      saveCharts(campaignId, next)
      return next
    })
  }

  const removeChart = (id: string) => {
    setCharts((c) => {
      const next = c.filter((x) => x.id !== id)
      saveCharts(campaignId, next)
      return next
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div>
          <p className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">Break down by</p>
          <Select value={draftDimension} onValueChange={setDraftDimension}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(dimensions ?? []).map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">Metric</p>
          <Select value={draftMetric} onValueChange={(v) => setDraftMetric(v as ChartMetric)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="events">Event count</SelectItem>
              <SelectItem value="journeys">Distinct journeys</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isTime && (
          <div>
            <p className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">Chart type</p>
            <Select value={draftKind} onValueChange={(v) => setDraftKind(v as ChartKind)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="pie">Pie</SelectItem>
                <SelectItem value="line">Line</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button size="sm" className="gap-1.5" onClick={addChart}>
          <Plus className="h-3.5 w-3.5" /> Add chart
        </Button>
      </div>

      {charts.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No charts yet — pick a field and a metric above, then "Add chart." Each one is a breakdown of this campaign's
          own events (e.g. "Distinct journeys by Step" repeats the funnel as a bar chart; "Event count by Channel" shows
          where activity is concentrated).
        </p>
      )}
      {charts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {charts.map((c) => (
            <CustomChartCard
              key={c.id}
              chart={c}
              dimensionLabel={dimensionLabel(c.dimension)}
              projectId={projectId}
              campaignId={campaignId}
              range={range}
              filters={filters}
              onRemove={() => removeChart(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * One milestone chip. Voice steps deep-link to the call behind them — the
 * same URL LogsOverlay's own drill-through opens. A source's own fields that
 * don't fit our columns (delivery_status, retry counts, ...) travel in
 * `payload` and show up here as a hover title — visible, not lost.
 */
function MilestoneChip({ event, projectId }: Readonly<{ event: JourneyEvent; projectId: string }>) {
  const label = event.step ?? event.action
  const canOpen = event.channel === 'voice' && event.agent_id && event.external_ref
  const payloadKeys = event.payload ? Object.keys(event.payload) : []
  const title = payloadKeys.length > 0
    ? payloadKeys.map((k) => `${k}: ${JSON.stringify(event.payload![k])}`).join('\n')
    : undefined

  const chip = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
        payloadKeys.length > 0 && 'cursor-help border-dashed'
      )}
      title={title}
    >
      {label}
    </span>
  )

  if (!canOpen) return chip
  return (
    <Link
      href={`/${projectId}/agents/${event.agent_id}/observability?session_id=${event.external_ref}`}
      target="_blank"
      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
    >
      {label}
    </Link>
  )
}

const JOURNEY_ROW_HEIGHT = 'h-14'
const JOURNEY_ROW_HEIGHT_PX = 56

/** One table row — milestones scroll horizontally instead of wrapping, so every row stays the same height regardless of how many events a journey has. */
function JourneyTableRow({ projectId, journey }: Readonly<{ projectId: string; journey: JourneySummary }>) {
  return (
    <tr className={cn(JOURNEY_ROW_HEIGHT, 'border-b border-gray-100 last:border-0 dark:border-gray-800/70')}>
      <td className="w-40 shrink-0 truncate px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100" title={journey.identity_key}>
        {journey.identity_key}
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {journey.events.map((e, i) => (
            <MilestoneChip key={`${journey.id}-${i}`} event={e} projectId={projectId} />
          ))}
        </div>
      </td>
      <td className="w-40 shrink-0 whitespace-nowrap px-4 py-2 text-right text-xs text-gray-500 dark:text-gray-400">
        {journey.status}
        {journey.outcome ? ` · ${journey.outcome}` : ''}
      </td>
    </tr>
  )
}

/**
 * One spacer row (not one per missing journey) so a short last page still
 * fills the table's fixed height — no array of interchangeable rows, so
 * there's no index-derived key to flag.
 */
function TableSpacerRow({ missingRows }: Readonly<{ missingRows: number }>) {
  if (missingRows <= 0) return null
  return <tr style={{ height: missingRows * JOURNEY_ROW_HEIGHT_PX }} />
}

export function JourneysTab({ projectId, isActive }: Readonly<{ projectId: string; isActive: boolean }>) {
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(projectId, isActive)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [range, setRange] = useState<OverviewRange>({ days: 30 })
  const [filters, setFilters] = useState<JourneyFilters>({})
  const {
    journeys,
    isLoading: journeysLoading,
    isFetching: journeysFetching,
    currentPage,
    isFirstPage,
    isLastPage,
    goToNextPage,
    goToPrevPage,
    resetPage,
  } = useRecentJourneys(projectId, campaignId, filters, isActive)
  const campaign = campaigns?.find((c) => c.id === campaignId)

  // filter options (channels/outcomes/agents) are per-campaign — a filter picked for one campaign is meaningless on another
  const handleCampaignChange = (id: string) => {
    setCampaignId(id)
    setFilters({})
    resetPage()
  }

  const handleFiltersChange = (f: JourneyFilters) => {
    setFilters(f)
    resetPage()
  }

  useEffect(() => {
    if (!campaignId && campaigns && campaigns.length > 0) setCampaignId(campaigns[0].id)
  }, [campaigns, campaignId])

  if (campaignsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
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

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-8 md:px-10">
        {/* Controls — boxed on purpose so it reads as "how you're filtering this page,"
            not just another section in the same list as the content below it. */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Select value={campaignId ?? undefined} onValueChange={handleCampaignChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? c.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <RangePicker range={range} onChange={setRange} />
              {campaign && <IntegrationDocs campaignKey={campaign.key} />}
            </div>
          </div>
          {campaignId && <FilterBar projectId={projectId} campaignId={campaignId} filters={filters} onChange={handleFiltersChange} />}
        </div>

        {campaignId && (
          <div className="space-y-10">
            {/* Zone 1: the fixed, always-there charts for this campaign. */}
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Overview</p>
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Funnel — steps in order, with drop-off between them</p>
                  <Funnel projectId={projectId} campaignId={campaignId} range={range} filters={filters} />
                </div>
                <div className="lg:col-span-2">
                  <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Active journeys — distinct activity per day</p>
                  <ActiveJourneysChart projectId={projectId} campaignId={campaignId} range={range} filters={filters} />
                </div>
              </div>
            </section>

            <hr className="border-gray-200 dark:border-gray-800" />

            {/* Zone 2: charts you build yourself, since the campaign's own shape isn't fixed ahead of time. */}
            <section>
              <SectionHeader title="Custom charts" subtitle="Build your own breakdown of this campaign's events — saved to this browser, per campaign." />
              <CustomChartBuilder projectId={projectId} campaignId={campaignId} range={range} filters={filters} />
            </section>

            <hr className="border-gray-200 dark:border-gray-800" />

            {/* Zone 3: the raw list, one row per journey. */}
            <section>
              <SectionHeader title="Recent journeys" subtitle="The most recently updated journeys in this campaign, with their full event history." />
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                {journeysLoading && (
                  <div className="flex h-[520px] items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
                {!journeysLoading && journeys.length === 0 && (
                  <div className="flex h-[520px] items-center justify-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No journeys for this campaign yet.</p>
                  </div>
                )}
                {!journeysLoading && journeys.length > 0 && (
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        <th className="w-40 px-4 py-2">Journey</th>
                        <th className="px-4 py-2">Milestones</th>
                        <th className="w-40 px-4 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journeys.map((j) => <JourneyTableRow key={j.id} projectId={projectId} journey={j} />)}
                      <TableSpacerRow missingRows={RECENT_JOURNEYS_PAGE_SIZE - journeys.length} />
                    </tbody>
                  </table>
                )}
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Page {currentPage}</span>
                <Button variant="outline" size="sm" disabled={isFirstPage || journeysLoading} onClick={goToPrevPage}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={isLastPage || journeysFetching} onClick={goToNextPage}>
                  {journeysFetching && !isLastPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
