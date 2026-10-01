'use client'

/**
 * The bell.
 *
 * Only shows what the night job actually decided was worth saying, so an empty
 * bell is the normal state and a badge means something real. Polls slowly on
 * purpose — nothing here is time-critical, and insights are only ever written
 * once a night.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Headphones, Sparkles } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

type Notification = {
  id: string
  agent_id: string | null
  insight_id: string | null
  kind: 'insight' | 'review_request'
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationBell({ projectId }: Readonly<{ projectId: string }>) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const { data } = useQuery<{ notifications: Notification[]; unread: number }>({
    queryKey: ['qa', 'notifications', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/qa/notifications?projectId=${projectId}`)
      if (!res.ok) return { notifications: [], unread: 0 }
      return res.json()
    },
    enabled: Boolean(projectId),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })

  const items = data?.notifications ?? []
  const unread = data?.unread ?? 0

  const markAllRead = async () => {
    await fetch('/api/qa/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
    qc.invalidateQueries({ queryKey: ['qa', 'notifications', projectId] })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label={unread ? `${unread} unread QA notifications` : 'QA notifications'}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">QA</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            Nothing to report. QA checks every night and only speaks when it matters.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-gray-50 overflow-auto dark:divide-gray-800/60">
            {items.map((n) => {
              const Icon = n.kind === 'review_request' ? Headphones : Sparkles
              const body = (
                <div className={`flex gap-3 px-4 py-3 ${n.read_at ? '' : 'bg-blue-50/50 dark:bg-blue-950/20'}`}>
                  <Icon className="mt-0.5 h-4 w-4 flex-none text-gray-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-gray-400">{ago(n.created_at)}</p>
                  </div>
                </div>
              )
              return (
                <li key={n.id}>
                  {n.link
                    ? <Link href={n.link} onClick={() => setOpen(false)} className="block hover:bg-gray-50 dark:hover:bg-gray-800/40">{body}</Link>
                    : body}
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
