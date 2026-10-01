'use client'

/**
 * Org → Analytics → QA.
 *
 * Answers exactly one question — which agent needs attention today — and then
 * gets out of the way. Detail belongs on the agent's own QA page, so every row
 * here is a link rather than an expander.
 */
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, ChevronRight, ShieldOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

type AgentRow = {
  id: string
  name: string
  enabled: boolean
  lastChecked: string | null
  callsTotal: number
  sampled: number
  p0Count: number
  topIssue: { key: string; label: string; pct: number | null } | null
  insight: { id: string; headline: string; severity: string } | null
}
type Payload = {
  agents: AgentRow[]
  issues: Array<{ key: string; label: string; priority: string; calls: number; agents: number }>
  windowDays: number
}

const pct1 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`)

const SEV_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  attention: 'bg-amber-500',
  info: 'bg-blue-500',
}

export function OrgQaTab({
  projectId, isActive,
}: Readonly<{ projectId: string; isActive: boolean }>) {
  const { data, isLoading, error } = useQuery<Payload>({
    queryKey: ['qa', 'project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/qa/project/${projectId}`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not load QA')
      return res.json()
    },
    enabled: isActive,
    staleTime: 60_000,
  })

  if (isLoading) return <div className="space-y-3 p-6"><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {(error as Error).message}
        </div>
      </div>
    )
  }

  const agents = data?.agents ?? []
  const withQa = agents.filter((a) => a.enabled)

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-5xl space-y-5">

        {withQa.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
            <ShieldOff className="mx-auto h-7 w-7 text-gray-300" />
            <p className="mt-3 font-medium text-gray-900 dark:text-gray-50">QA is not switched on for any agent here</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Once it is, 200 calls per agent are checked every night and anything worth raising appears here.
            </p>
          </div>
        )}

        {withQa.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                Agents
                <span className="ml-2 font-normal text-gray-400">the ones with something to say come first</span>
              </h3>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                  <th className="px-5 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Last checked</th>
                  <th className="px-3 py-2 font-medium">Calls</th>
                  <th className="px-3 py-2 font-medium">Top issue</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {withQa.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 dark:border-gray-800/60 dark:hover:bg-gray-800/40">
                    <td className="px-5 py-3">
                      <div className="flex items-start gap-2">
                        {a.insight
                          ? <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${SEV_DOT[a.insight.severity] ?? SEV_DOT.info}`} />
                          : <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-500" />}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{a.name}</div>
                          {a.insight && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{a.insight.headline}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500">{a.lastChecked ?? 'never'}</td>
                    <td className="px-3 py-3 text-gray-500">
                      {a.sampled} <span className="text-gray-400">of {a.callsTotal}</span>
                    </td>
                    <td className="px-3 py-3">
                      {a.topIssue
                        ? <span className="text-gray-700 dark:text-gray-300">{a.topIssue.label} <span className="text-gray-400">{pct1(a.topIssue.pct)}</span></span>
                        : <span className="text-gray-400">nothing</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/${projectId}/agents/${a.id}/qa`}
                        className="inline-flex items-center text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Open <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(data?.issues?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                Across the project
                <span className="ml-2 font-normal text-gray-400">last {data?.windowDays} days</span>
              </h3>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {data!.issues.map((i) => (
                <li key={i.key} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    {i.priority === 'P0' && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                    <span className="text-gray-900 dark:text-gray-100">{i.label}</span>
                  </span>
                  <span className="text-gray-500">
                    {i.calls} calls <span className="text-gray-400">· {i.agents} agent{i.agents === 1 ? '' : 's'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrgQaTab
