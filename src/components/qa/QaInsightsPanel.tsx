'use client'

/**
 * The agent's QA page — Confluence "Automated Call QA — Design" §7.
 *
 * The thing this screen has to get right is the quiet state. Most nights there
 * is no insight, and a page that looks empty on a quiet night reads as broken.
 * So it always says what was checked and when, even when the answer is
 * "nothing new". Silence is a result and it is shown as one.
 *
 * Nothing here computes a number. The night job already did the counting; this
 * renders what it wrote, which is also why "down 4 points on last week" costs a
 * lookup rather than a scan over old calls.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronDown, ChevronRight,
  Headphones, Minus, Sparkles, Clock, Settings, Mail,
  AlertTriangle, AlertCircle, Info, Check, Loader2,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PromptPatchDialog from './PromptPatchDialog'
import QaSettingsDialog from './QaSettingsDialog'
import QaSubscriptions from './QaSubscriptions'
import ReviewList from './ReviewList'

type Bullet = { text: string; issue_key: string | null; calls: number | null; pct: number | null; call_ids?: string[] }
type PromptPatch = {
  section: string; remove: string[]; add: string[]; why: string; issue_key: string | null; call_ids?: string[]
  target?: 'system_prompt' | 'field_extractor_prompt'
}
type Insight = {
  id: string
  run_date: string
  severity: 'info' | 'attention' | 'urgent'
  headline: string
  bullets: Bullet[]
  suggested_prompt_patch: PromptPatch | null
  trigger: string | null
  status: string
  acted_at: string | null
}
type Issue = {
  key: string; label: string; priority: string; category: string | null
  fixableBy: string | null; flagged: number; random: number
  pct: number | null; was: number | null; delta: number | null; isNew: boolean; callIds: string[]
  example: { callId: string; seconds: number | null; evidence: string | null } | null
}
type Metric = { key: string; rate: number | null; n: number; was: number | null; delta: number | null }

type Payload = {
  agent: { id: string; name: string; projectId: string }
  canWrite: boolean
  qaConfig: Record<string, unknown> | null
  today: { date: string; callsTotal: number; sampled: number; flagged: number; random: number } | null
  lastRun: { date: string; status: string; callsSeen: number; finishedAt: string | null; error: string | null } | null
  currentInsight: Insight | null
  reviewRequested?: boolean
  insights: Insight[]
  issues: Issue[]
  metrics: Metric[]
  trend: Array<Record<string, unknown>>
  trendKeys: Array<{ key: string; label: string }>
  knownDispositions?: string[]
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(0)}%`)
const pct1 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`)
// below this many calls a change from the usual is mostly noise, so it isn't shown
const MIN_CALLS_FOR_CHANGE = 20
const humanize = (key: string) => key.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())
const daysSince = (isoDate: string) => Math.floor((Date.now() - new Date(`${isoDate}T00:00:00`).getTime()) / 86_400_000)

// One real color, spent on the one thing that deserves it: an urgent insight.
// Everything else — attention, info, priority badges, the trend lines — stays
// grayscale, so red actually means something when it shows up.
const SEVERITY: Record<string, {
  ring: string; accent: string; wash: string; chip: string; dot: string; label: string
  Icon: typeof AlertTriangle
}> = {
  urgent: {
    ring: 'border-red-200 dark:border-red-900',
    accent: 'border-l-red-500 dark:border-l-red-500',
    wash: 'bg-red-50/60 dark:bg-red-950/20',
    chip: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    dot: 'bg-red-500',
    label: 'Needs attention',
    Icon: AlertTriangle,
  },
  attention: {
    ring: 'border-gray-200 dark:border-gray-800',
    accent: 'border-l-gray-400 dark:border-l-gray-600',
    wash: 'bg-gray-50 dark:bg-gray-800/40',
    chip: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    dot: 'bg-gray-400',
    label: 'Worth a look',
    Icon: AlertCircle,
  },
  info: {
    ring: 'border-gray-200 dark:border-gray-800',
    accent: 'border-l-gray-300 dark:border-l-gray-700',
    wash: 'bg-gray-50 dark:bg-gray-800/40',
    chip: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    dot: 'bg-gray-300',
    label: 'For information',
    Icon: Info,
  },
}

const LINE_COLOURS = ['#111827', '#6b7280', '#9ca3af', '#2563eb', '#93c5fd']

const FIXABLE_BY_LABEL: Record<string, string> = { prompt: 'Prompt', pype: 'Pype' }
const fixableByLabel = (fixableBy: string | null) => FIXABLE_BY_LABEL[fixableBy ?? ''] ?? 'Customer'

/** Up is not always good: for an issue rate, up is bad. Wording over arrows-and-colour alone. */
function Delta({ value, goodWhenDown = true }: Readonly<{ value: number | null; goodWhenDown?: boolean }>) {
  if (value === null) return <span className="text-xs text-gray-400">—</span>
  if (Math.abs(value) < 0.005) {
    return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Minus className="h-3 w-3" />No change</span>
  }
  const rose = value > 0
  const bad = goodWhenDown ? rose : !rose
  const Icon = rose ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${bad ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
      <Icon className="h-3 w-3" />
      {rose ? 'Up' : 'Down'} {Math.abs(value * 100).toFixed(1)} pts
    </span>
  )
}

function AskQaLabel({ asking, asked }: Readonly<{ asking: boolean; asked: boolean }>) {
  if (asking) return <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Asking QA…</>
  if (asked) return <><Check className="mr-1.5 h-3.5 w-3.5" />QA has been asked</>
  return <><Headphones className="mr-1.5 h-3.5 w-3.5" />Ask QA to check this</>
}

function askedMessage(body: { alreadyRequested?: boolean; mailed?: boolean } | null): string {
  if (body?.alreadyRequested) return 'QA has already been asked about this.'
  if (body?.mailed) return "We've mailed the Pype QA team — they'll follow up."
  return "Added to the QA team's review queue."
}

function InsightCard({
  insight, canWrite, asked, asking, onReviewPatch, onAskQa, onDismiss,
}: Readonly<{
  insight: Insight
  canWrite: boolean
  onReviewPatch: () => void
  asked: boolean
  asking: boolean
  onAskQa: () => void
  onDismiss: () => void
}>) {
  const sev = SEVERITY[insight.severity] ?? SEVERITY.info
  return (
    <div className={`overflow-hidden rounded-xl border border-l-4 bg-white shadow-sm dark:bg-gray-900 ${sev.ring} ${sev.accent}`}>
      <div className="p-6">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-400" title="Written by AI from the calls checked. Open the calls to verify.">
          <Sparkles className="h-3 w-3" />AI summary · {insight.run_date}
        </p>
        <h2 className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-50">{insight.headline}</h2>
        <ul className="mt-4 space-y-2.5">
          {insight.bullets.slice(0, 3).map((b, i) => (
            <li key={`${b.issue_key ?? 'b'}-${i}`} className="flex gap-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              <span className={`mt-2 h-1.5 w-1.5 flex-none rounded-full ${sev.dot}`} />
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
        {insight.suggested_prompt_patch && (
          <Button size="sm" onClick={onReviewPatch} disabled={!canWrite}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Review prompt change
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onAskQa} disabled={asked || asking}>
          <AskQaLabel asking={asking} asked={asked} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} title="Hides this insight for everyone on the project">
          Dismiss
        </Button>
        {!canWrite && insight.suggested_prompt_patch && (
          <span className="text-xs text-gray-400">Admin access is needed to change a prompt</span>
        )}
      </div>
    </div>
  )
}

function QuietState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-500" />
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-50">Nothing new to report</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            We checked a sample of recent calls and found nothing worth interrupting anyone for.
            Everything we looked at is listed below.
          </p>
        </div>
      </div>
    </div>
  )
}

function MetricsGrid({ metrics }: Readonly<{ metrics: Metric[] }>) {
  if (!metrics.length) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
        Key measures
        {' '}<span className="ml-2 font-normal text-gray-400">latest check, compared with the last 30 days</span>
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.key} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <div className="truncate text-xs text-gray-500 dark:text-gray-400" title={m.key}>{humanize(m.key)}</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-50">{pct(m.rate)}</div>
            <div className="mt-1 flex items-center justify-between">
              {m.n >= MIN_CALLS_FOR_CHANGE ? <Delta value={m.delta} goodWhenDown={false} /> : <span className="text-xs text-gray-400">Too few calls to compare</span>}
              <span className="text-xs text-gray-400">{m.n} calls</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendChart({
  trend, trendKeys,
}: Readonly<{ trend: Array<Record<string, unknown>>; trendKeys: Array<{ key: string; label: string }> }>) {
  if (trend.length <= 1 || !trendKeys.length) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
        How the top issues are moving
        {' '}<span className="ml-2 font-normal text-gray-400">share of sampled calls, by day</span>
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} width={44} />
            <Tooltip
              formatter={(value, name) => [
                pct1(typeof value === 'number' ? value : Number(value)),
                trendKeys.find((k) => k.key === name)?.label ?? String(name),
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend formatter={(v) => trendKeys.find((k) => k.key === v)?.label ?? v} wrapperStyle={{ fontSize: 11 }} />
            {trendKeys.map((k, i) => (
              <Line
                key={k.key}
                type="monotone"
                dataKey={k.key}
                stroke={LINE_COLOURS[i % LINE_COLOURS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** The glance view: five plain lines, no columns. The full table lives behind "Show details". */
function TopIssues({
  issues, projectId, agentId,
}: Readonly<{ issues: Issue[]; projectId: string; agentId: string }>) {
  const top = issues.slice(0, 5)
  if (!top.length) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <h3 className="px-6 pt-5 text-sm font-semibold text-gray-900 dark:text-gray-50">What to look at first</h3>
      <ul className="divide-y divide-gray-100 px-6 pb-2 dark:divide-gray-800">
        {top.map((issue) => {
          const callId = issue.example?.callId ?? issue.callIds[0]
          return (
            <li key={issue.key} className="flex items-center justify-between gap-4 py-3.5">
              <span className="text-sm text-gray-800 dark:text-gray-200">{issue.label}</span>
              <span className="flex flex-none items-center gap-4">
                <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{pct(issue.pct)} of calls</span>
                {callId ? (
                  <a
                    href={`/${projectId}/agents/${agentId}/observability?session_id=${callId}${issue.example?.seconds ? `&t=${issue.example.seconds}` : ''}`}
                    className="inline-flex w-16 items-center justify-end text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Listen<ChevronRight className="h-3 w-3" />
                  </a>
                ) : <span className="w-16" />}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function IssueTable({
  issues, projectId, agentId, sampleSize,
}: Readonly<{ issues: Issue[]; projectId: string; agentId: string; sampleSize: number }>) {
  const showChange = sampleSize >= MIN_CALLS_FOR_CHANGE
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          All issues found
          {' '}<span className="ml-2 font-normal text-gray-400">most important first</span>
        </h3>
      </div>

      {issues.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">Nothing found in the calls that were checked.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-400 dark:border-gray-800">
              <th className="px-5 py-2 font-medium">Issue</th>
              <th className="px-3 py-2 text-right font-medium">Share of calls</th>
              <th className="px-3 py-2 text-right font-medium" title="Compared with the last 30 days">Change</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.key} className="border-b border-gray-50 align-top last:border-0 hover:bg-gray-50 dark:border-gray-800/60 dark:hover:bg-gray-800/40">
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{issue.label}</span>
                    {issue.priority === 'P0' && (
                      <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-gray-100 dark:text-gray-900">High impact</span>
                    )}
                    {issue.isNew && showChange && (
                      <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">New</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {issue.category ? `${humanize(issue.category)} · ` : ''}Fixed by {fixableByLabel(issue.fixableBy).toLowerCase()}
                  </p>
                  {issue.example?.evidence && (
                    <p className="mt-1 line-clamp-2 max-w-xl text-xs italic text-gray-500 dark:text-gray-400">“{issue.example.evidence}”</p>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{pct1(issue.pct)}</div>
                  {sampleSize > 0 && <div className="text-xs text-gray-400">{issue.random} of {sampleSize} calls</div>}
                </td>
                <td className="px-3 py-3 text-right">{showChange ? <Delta value={issue.delta} /> : <span className="text-xs text-gray-400">—</span>}</td>
                <td className="px-3 py-3 text-right">
                  {(issue.example || issue.callIds.length > 0) && (
                    <a
                      href={
                        `/${projectId}/agents/${agentId}/observability?session_id=${issue.example?.callId ?? issue.callIds[0]}`
                        // seek straight to the moment when we know it
                        + (issue.example?.seconds ? `&t=${issue.example.seconds}` : '')
                      }
                      className="inline-flex items-center whitespace-nowrap text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {issue.example?.seconds ? 'Hear it' : 'See a call'}
                      <ChevronRight className="h-3 w-3" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PreviousInsights({ insights, currentId }: Readonly<{ insights: Insight[]; currentId: string | undefined }>) {
  const previous = insights.filter((i) => i.id !== currentId)
  if (!previous.length) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
        Previously
        {' '}<span className="ml-2 font-normal text-gray-400">and whether it was acted on</span>
      </h3>
      <ul className="space-y-2">
        {previous.slice(0, 8).map((i) => (
          <li key={i.id} className="flex items-start gap-3 text-sm">
            <span className="w-20 flex-none pt-0.5 text-xs text-gray-400">{i.run_date}</span>
            <span className="flex-1 text-gray-700 dark:text-gray-300">{i.headline}</span>
            {i.acted_at ? (
              <span className="flex-none text-xs text-emerald-600 dark:text-emerald-400">prompt changed</span>
            ) : (
              <span className="flex-none text-xs capitalize text-gray-400">{i.status}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** QA has never run here. Say what to do rather than showing empty charts. */
function NeverRunState({
  hasConfig, canWrite, agentId, settingsOpen, onSettingsOpenChange, knownDispositions, qaConfig, onSaved,
}: Readonly<{
  hasConfig: boolean
  canWrite: boolean
  agentId: string
  settingsOpen: boolean
  onSettingsOpenChange: (v: boolean) => void
  knownDispositions: string[]
  qaConfig: Record<string, unknown> | null
  onSaved: () => void
}>) {
  const title = hasConfig ? 'QA has not run for this agent yet' : 'QA is not switched on for this agent'
  const body = hasConfig
    ? 'It is switched on — the first check runs tonight. An insight appears here only when there is one worth raising.'
    : 'Switch it on and a sample of this agent’s calls is checked every night. An insight appears here only when there is one worth raising.'

  return (
    <div className="p-6">
      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <Sparkles className="mx-auto h-8 w-8 text-gray-300" />
        <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-50">{title}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{body}</p>
        {canWrite ? (
          <Button className="mt-4" onClick={() => onSettingsOpenChange(true)}>
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            {hasConfig ? 'QA settings' : 'Set up QA'}
          </Button>
        ) : (
          <p className="mt-4 text-xs text-gray-400">An admin on this project can switch it on.</p>
        )}
      </div>

      <QaSettingsDialog
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
        agentId={agentId}
        initial={(qaConfig as never) ?? null}
        knownDispositions={knownDispositions}
        onSaved={onSaved}
      />
    </div>
  )
}

export default function QaInsightsPanel({
  agentId,
  projectId,
  isActive = true,
  onAgentName,
}: Readonly<{ agentId: string; projectId: string; isActive?: boolean; onAgentName?: (name: string) => void }>) {
  const [patchOpen, setPatchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [tab, setTab] = useState<'insight' | 'review'>('insight')
  const [showDetails, setShowDetails] = useState(false)

  const { data, isLoading, error, refetch } = useQuery<Payload>({
    queryKey: ['qa', 'agent', agentId],
    queryFn: async () => {
      const res = await fetch(`/api/qa/agent/${agentId}`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not load QA')
      return res.json()
    },
    enabled: isActive && Boolean(agentId),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (data?.agent?.name) onAgentName?.(data.agent.name)
    // onAgentName identity isn't stable across renders in the page that owns it — depend on the name itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.agent?.name])

  const insight = data?.currentInsight ?? null
  const trendKeys = data?.trendKeys ?? []

  const lastCheckedLabel = useMemo(() => {
    if (!data?.lastRun) return null
    const { date, callsSeen, status } = data.lastRun
    if (status === 'failed') return `The check on ${date} did not finish${data.lastRun.error ? ` (${data.lastRun.error})` : ''}`
    if (status === 'skipped') return `Nothing to check on ${date}`
    return `Last checked ${date} · ${callsSeen} calls reviewed`
  }, [data?.lastRun])

  const lastDate = data?.today?.date ?? data?.lastRun?.date ?? null
  const staleDays = lastDate ? daysSince(lastDate) : null

  const [asking, setAsking] = useState(false)
  const [askedIds, setAskedIds] = useState<string[]>([])
  const askedAlready = Boolean(insight && (data?.reviewRequested || askedIds.includes(insight.id)))

  const askQaToCheck = async () => {
    if (!insight || asking || askedAlready) return
    setAsking(true)
    try {
      const res = await fetch('/api/qa/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId, insightId: insight.id }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error || 'Could not ask QA right now. Please try again.')
        return
      }
      setAskedIds((ids) => [...ids, insight.id])
      toast.success(askedMessage(body))
      setTab('review')
      refetch()
    } catch {
      toast.error('Could not reach the server. Please try again.')
    } finally {
      setAsking(false)
    }
  }

  const dismissInsight = async () => {
    if (!insight) return
    try {
      const res = await fetch(`/api/qa/insights/${insight.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Insight dismissed')
    } catch {
      toast.error('Could not dismiss this insight. Please try again.')
    }
    refetch()
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {(error as Error).message}
          <Button size="sm" variant="outline" className="ml-3" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    )
  }

  // QA has never run here. Say what to do rather than showing empty charts.
  if (!data?.today && !data?.lastRun) {
    return (
      <NeverRunState
        hasConfig={Boolean(data?.qaConfig)}
        canWrite={Boolean(data?.canWrite)}
        agentId={agentId}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
        knownDispositions={data?.knownDispositions ?? []}
        qaConfig={data?.qaConfig ?? null}
        onSaved={refetch}
      />
    )
  }

  return (
    <div className="h-full overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl space-y-5">

        {staleDays !== null && staleDays >= 2 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            These results are {staleDays} days old — the nightly check may not have run since. Numbers below reflect {data.today?.date ?? data.lastRun?.date}.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400" title={data.today ? `${data.today.sampled} of ${data.today.callsTotal} calls were sampled` : undefined}>
            <Clock className="h-4 w-4" />
            {lastCheckedLabel ?? 'Not checked yet'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSubscribeOpen(true)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-label="Who gets QA email for this agent"
              title="Who gets QA email for this agent"
            >
              <Mail className="h-4 w-4" />
            </button>
            {data.canWrite && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="QA settings"
                title="QA settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-1 rounded-lg bg-white p-1 dark:bg-gray-900">
              {(['insight', 'review'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1 text-sm ${
                    tab === t
                      ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-50'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {t === 'insight' ? 'Summary' : 'Calls to review'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {tab === 'review' ? (
          <ReviewList agentId={agentId} projectId={projectId} />
        ) : (
          <>
            {/* ---------------------------------------------- the insight */}
            {insight ? (
              <InsightCard
                insight={insight}
                canWrite={data.canWrite}
                onReviewPatch={() => setPatchOpen(true)}
                asked={askedAlready}
                asking={asking}
                onAskQa={askQaToCheck}
                onDismiss={dismissInsight}
              />
            ) : (
              <QuietState />
            )}

            <TopIssues issues={data.issues} projectId={projectId} agentId={agentId} />

            <button
              onClick={() => setShowDetails((v) => !v)}
              className="mx-auto flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showDetails ? 'Hide details' : 'Show full details'}
              <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>

            {showDetails && (
              <>
                <MetricsGrid metrics={data.metrics} />
                <TrendChart trend={data.trend} trendKeys={trendKeys} />
                <IssueTable issues={data.issues} projectId={projectId} agentId={agentId} sampleSize={data.today?.random ?? 0} />
                <PreviousInsights insights={data.insights} currentId={insight?.id} />
              </>
            )}
          </>
        )}
      </div>

      <QaSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        agentId={agentId}
        initial={(data.qaConfig as never) ?? null}
        knownDispositions={data.knownDispositions ?? []}
        onSaved={refetch}
      />

      <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Who gets QA email for this agent</DialogTitle>
          </DialogHeader>
          <QaSubscriptions
            projectId={projectId}
            agents={[{ id: agentId, name: data.agent?.name || 'this agent' }]}
            lockAgentId={agentId}
          />
        </DialogContent>
      </Dialog>

      {insight?.suggested_prompt_patch && (
        <PromptPatchDialog
          open={patchOpen}
          onOpenChange={setPatchOpen}
          insightId={insight.id}
          agentId={agentId}
          patch={insight.suggested_prompt_patch}
          onPublished={() => { setPatchOpen(false); refetch() }}
        />
      )}
    </div>
  )
}
