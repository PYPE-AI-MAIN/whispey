'use client'

/**
 * The listen list — Confluence "Automated Call QA — Design" §9.
 *
 * Not a new screen so much as an ordered one. Today a reviewer opens a hundred
 * flagged calls with no order and no stated reason; here there are twenty-odd,
 * ranked, each saying why it is on the list. If there is no time, the top ten
 * still cover what matters.
 *
 * Confirming or rejecting a tag is also how the judge gets measured — the
 * running confirmed-vs-rejected ratio per issue is its accuracy score.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Headphones, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type Item = {
  id: string
  call_log_id: string
  reason: string
  rank: number
  status: 'pending' | 'in_review' | 'done' | 'skipped'
  note: string | null
  assigned_to: string | null
  created_at: string
}

export default function ReviewList({
  agentId, projectId,
}: Readonly<{ agentId: string; projectId: string }>) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ items: Item[] }>({
    queryKey: ['qa', 'review', agentId],
    queryFn: async () => {
      const res = await fetch(`/api/qa/review?agentId=${agentId}`)
      if (!res.ok) throw new Error('Could not load the review list')
      return res.json()
    },
    staleTime: 30_000,
  })

  const update = async (itemId: string, status: Item['status']) => {
    await fetch('/api/qa/review', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId, status }),
    })
    qc.invalidateQueries({ queryKey: ['qa', 'review', agentId] })
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />

  const items = data?.items ?? []
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'in_review')
  const done = items.filter((i) => i.status === 'done' || i.status === 'skipped')

  if (!items.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <Headphones className="mx-auto h-7 w-7 text-gray-300" />
        <p className="mt-3 font-medium text-gray-900 dark:text-gray-50">Nothing waiting to be listened to</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Use <span className="font-medium">Ask QA to check this</span> on an insight to build a list.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {pending.length} calls to listen to
            <span className="ml-2 font-normal text-gray-400">in order — the top ones matter most</span>
          </h3>
        </div>

        <ol className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {pending.map((item, i) => (
            <li key={item.id} className="flex items-start gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <span className="mt-0.5 w-5 flex-none text-sm font-medium text-gray-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 dark:text-gray-100">{item.reason}</p>
                <a
                  href={`/${projectId}/agents/${agentId}/observability?session_id=${item.call_log_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Open the call <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex flex-none gap-1">
                <Button size="sm" variant="ghost" title="Reviewed" onClick={() => update(item.id, 'done')}>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                </Button>
                <Button size="sm" variant="ghost" title="Not worth listening to" onClick={() => update(item.id, 'skipped')}>
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {done.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-50">Already reviewed</h3>
          <ul className="space-y-1.5">
            {done.slice(0, 10).map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                {item.status === 'done'
                  ? <Check className="h-3.5 w-3.5 flex-none text-emerald-500" />
                  : <X className="h-3.5 w-3.5 flex-none text-gray-300" />}
                <span className="truncate">{item.reason}</span>
                {item.assigned_to && <span className="flex-none text-xs text-gray-400">{item.assigned_to}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
