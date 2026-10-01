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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight,
  Headphones, Minus, Sparkles, Clock,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import PromptPatchDialog from './PromptPatchDialog'
import ReviewList from './ReviewList'

type Bullet = { text: string; issue_key: string | null; calls: number | null; pct: number | null; call_ids?: string[] }
type PromptPatch = { section: string; remove: string[]; add: string[]; why: string; issue_key: string | null; call_ids?: string[] }
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
  insights: Insight[]
  issues: Issue[]
  metrics: Metric[]
  trend: Array<Record<string, unknown>>
  trendKeys: Array<{ key: string; label: string }>
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(0)}%`)
const pct1 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`)

const SEVERITY: Record<string, { ring: string; chip: string; label: string }> = {
  urgent: { ring: 'border-red-300 dark:border-red-800', chip: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200', label: 'Needs attention' },
  attention: { ring: 'border-amber-300 dark:border-amber-800', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200', label: 'Worth a look' },
  info: { ring: 'border-blue-200 dark:border-blue-900', chip: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200', label: 'For information' },
}

const PRIORITY: Record<string, string> = {
  P0: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  P1: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  P2: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const LINE_COLOURS = ['#dc2626', '#ea580c', '#ca8a04', '#2563eb', '#7c3aed']

/** Up is not always good: for an issue rate, up is bad. */
function Delta({ value, goodWhenDown = true }: Readonly<{ value: number | null; goodWhenDown?: boolean }>) {
  if (value === null || Math.abs(value) < 0.005) {
    return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Minus className="h-3 w-3" />flat</span>
  }
  const rose = value > 0
  const bad = goodWhenDown ? rose : !rose
  const Icon = rose ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${bad ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
      <Icon className="h-3 w-3" />
      {rose ? '+' : ''}{(value * 100).toFixed(1)} pts
    </span>
  )
}

export default function QaInsightsPanel({
  agentId,
  projectId,
  isActive = true,
}: Readonly<{ agentId: string; projectId: string; isActive?: boolean }>) {
  const [patchOpen, setPatchOpen] = useState(false)
  const [tab, setTab] = useState<'insight' | 'review'>('insight')

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

  const insight = data?.currentInsight ?? null
  const sev = SEVERITY[insight?.severity ?? 'info']

  const trendKeys = data?.trendKeys ?? []
  const hasTrend = (data?.trend?.length ?? 0) > 1

  const lastCheckedLabel = useMemo(() => {
    if (!data?.lastRun) return null
    const { date, callsSeen, status } = data.lastRun
    if (status === 'failed') return `Last run on ${date} did not finish`
    if (status === 'skipped') return `Nothing to check on ${date}`
    return `Checked overnight · ${date} · ${callsSeen} calls`
  }, [data?.lastRun])

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
        </div>
      </div>
    )
  }

  // QA has never run here. Say what to do rather than showing empty charts.
  if (!data?.today && !data?.lastRun) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <Sparkles className="mx-auto h-8 w-8 text-gray-300" />
          <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-50">QA has not run for this agent yet</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Once QA is switched on, 200 of this agent&apos;s calls are checked every night and an insight
            appears here — but only when there is one worth raising.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-gray-50 p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* what was checked — shown on every state, so a quiet night never
            looks like a broken page */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <span>{lastCheckedLabel ?? 'Not checked yet'}</span>
            {data.today && (
              <span className="text-gray-400 dark:text-gray-500">
                ({data.today.flagged} flagged, {data.today.random} random, of {data.today.callsTotal} made)
              </span>
            )}
          </div>
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
                {t === 'insight' ? 'Insight' : 'To listen to'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'review' ? (
          <ReviewList agentId={agentId} projectId={projectId} />
        ) : (
          <>
            {/* ---------------------------------------------- the insight */}
            {insight ? (
              <div className={`rounded-xl border bg-white shadow-sm dark:bg-gray-900 ${sev.ring}`}>
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sev.chip}`}>{sev.label}</span>
                      <span className="text-xs text-gray-400">{insight.run_date}</span>
                      {insight.trigger && <Badge variant="outline" className="text-xs capitalize">{insight.trigger}</Badge>}
                    </div>
                    <h2 className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-50">
                      {insight.headline}
                    </h2>
                  </div>
                </div>

                <ul className="space-y-3 p-5">
                  {insight.bullets.map((b, i) => (
                    <li key={`${b.issue_key ?? 'b'}-${i}`} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-gray-400" />
                      <span>
                        {b.text}
                        {b.pct !== null && (
                          <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{pct1(b.pct)} of sampled calls</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 p-4 dark:border-gray-800">
                  {insight.suggested_prompt_patch && (
                    <Button size="sm" onClick={() => setPatchOpen(true)} disabled={!data.canWrite}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Review prompt change
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await fetch('/api/qa/review', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ agentId, insightId: insight.id }),
                      })
                      setTab('review')
                      refetch()
                    }}
                  >
                    <Headphones className="mr-1.5 h-3.5 w-3.5" />
                    Ask QA to check this
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await fetch(`/api/qa/insights/${insight.id}`, {
                        method: 'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ status: 'dismissed' }),
                      })
                      refetch()
                    }}
                  >
                    Dismiss
                  </Button>
                  {!data.canWrite && insight.suggested_prompt_patch && (
                    <span className="text-xs text-gray-400">Admin access is needed to change a prompt</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-500" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-50">Nothing new to report</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      The calls below were checked. Nothing crossed the line where it is worth interrupting
                      someone — no new issue, nothing worse than last week, no measure down.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------- the numbers */}
            {data.metrics.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  This agent&apos;s measures
                  <span className="ml-2 font-normal text-gray-400">from the random sample, against the last 30 days</span>
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {data.metrics.map((m) => (
                    <div key={m.key} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                      <div className="truncate font-mono text-xs text-gray-500 dark:text-gray-400" title={m.key}>{m.key}</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-50">{pct(m.rate)}</div>
                      <div className="mt-1 flex items-center justify-between">
                        <Delta value={m.delta} goodWhenDown={false} />
                        <span className="text-xs text-gray-400">n={m.n}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --------------------------------------------------- the trend */}
            {hasTrend && trendKeys.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  How the top issues are moving
                  <span className="ml-2 font-normal text-gray-400">share of sampled calls</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
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
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* --------------------------------------------- the issue list */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  Everything found last night
                  <span className="ml-2 font-normal text-gray-400">ranked by how much it matters, not by count</span>
                </h3>
              </div>

              {data.issues.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">Nothing found in the calls that were checked.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                      <th className="px-5 py-2 font-medium">Issue</th>
                      <th className="px-3 py-2 font-medium">Rate</th>
                      <th className="px-3 py-2 font-medium">vs last</th>
                      <th className="px-3 py-2 font-medium">Flagged</th>
                      <th className="px-3 py-2 font-medium">Fix</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.issues.map((issue) => (
                      <tr key={issue.key} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 dark:border-gray-800/60 dark:hover:bg-gray-800/40">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY[issue.priority] ?? PRIORITY.P2}`}>
                              {issue.priority}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{issue.label}</span>
                            {issue.isNew && (
                              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                NEW
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100">{pct1(issue.pct)}</td>
                        <td className="px-3 py-3"><Delta value={issue.delta} /></td>
                        <td className="px-3 py-3 text-gray-500">{issue.flagged}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs capitalize text-gray-500">
                            {issue.fixableBy === 'prompt' ? 'Prompt' : issue.fixableBy === 'pype' ? 'Pype' : 'Customer'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {(issue.example || issue.callIds.length > 0) && (
                            <a
                              href={
                                `/${projectId}/agents/${agentId}/observability?session_id=${issue.example?.callId ?? issue.callIds[0]}`
                                // seek straight to the moment when we know it
                                + (issue.example?.seconds ? `&t=${issue.example.seconds}` : '')
                              }
                              title={issue.example?.evidence ?? undefined}
                              className="inline-flex items-center text-xs text-blue-600 hover:underline dark:text-blue-400"
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

            {/* ------------------------------------------------- past insights */}
            {data.insights.filter((i) => i.id !== insight?.id).length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  Previously
                  <span className="ml-2 font-normal text-gray-400">and whether it was acted on</span>
                </h3>
                <ul className="space-y-2">
                  {data.insights.filter((i) => i.id !== insight?.id).slice(0, 8).map((i) => (
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
            )}
          </>
        )}
      </div>

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
