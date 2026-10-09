'use client'

/**
 * QA Audit — two tabs.
 *
 * Flagged calls: every call a customer flagged becomes a ticket here, with its
 * reason and where the QA team has got to (pending → in review → resolved).
 * Weekly review: the customer asks for a whole finished week of calls to be
 * reviewed; the QA team attaches the Google Sheet and it shows up as a link.
 *
 * The QA team (see server/qa/access.ts) gets the update controls; everyone else
 * sees the same rows read-only.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, ExternalLink, FileSpreadsheet, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type Ticket = {
  id: string
  call_log_id: string
  reason: string
  flagged_by_email: string | null
  flagged_at: string
  status: 'pending' | 'in_review' | 'resolved'
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
}

type Review = {
  id: string
  week_start: string
  week_end: string
  requested_by_email: string | null
  requested_at: string
  status: 'requested' | 'in_progress' | 'ready'
  sheet_url: string | null
  note: string | null
  ready_at: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', in_review: 'In review', resolved: 'Resolved',
  requested: 'Requested', in_progress: 'In progress', ready: 'Ready',
}
const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  requested: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  in_review: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const fmtWeek = (start: string, end: string) => `${fmtDate(`${start}T00:00:00`)} – ${fmtDate(`${end}T00:00:00`)}`

function StatusPill({ status }: Readonly<{ status: string }>) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status] ?? ''}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Something went wrong')
  return json
}

const selectClass = 'h-9 rounded-md border border-gray-200 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900'

export default function QaAuditPanel({ agentId, projectId }: Readonly<{ agentId: string; projectId: string }>) {
  return (
    <Tabs defaultValue="flagged" className="flex h-full flex-col">
      <div className="flex-none border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900 md:px-8">
        <TabsList className="h-11 bg-transparent p-0">
          <TabsTrigger value="flagged" className="gap-1.5"><Flag className="h-4 w-4" /> Flagged calls</TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1.5"><CalendarCheck className="h-4 w-4" /> Weekly review</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="flagged" className="mt-0 min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
        <FlaggedCalls agentId={agentId} projectId={projectId} />
      </TabsContent>
      <TabsContent value="weekly" className="mt-0 min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
        <WeeklyReview agentId={agentId} />
      </TabsContent>
    </Tabs>
  )
}

function FlaggedCalls({ agentId, projectId }: Readonly<{ agentId: string; projectId: string }>) {
  const [filter, setFilter] = useState<'all' | Ticket['status']>('all')
  const { data, isLoading, error } = useQuery<{ tickets: Ticket[]; canManage: boolean }>({
    queryKey: ['qa-audit', 'flags', agentId],
    queryFn: async () => {
      const res = await fetch(`/api/qa-audit/flags?agentId=${agentId}`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not load flagged calls')
      return res.json()
    },
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>

  const tickets = data?.tickets ?? []
  const shown = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter)
  const count = (s: string) => tickets.filter((t) => t.status === s).length

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Calls flagged from the call logs land here, and the QA team works through them.
      </p>
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'in_review', 'resolved'] as const).map((s) => (
          <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
            {s === 'all' ? `All (${tickets.length})` : `${STATUS_LABEL[s]} (${count(s)})`}
          </Button>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
          {tickets.length === 0 ? 'No flagged calls yet. Flag a call from the call logs and it will show up here.' : 'Nothing in this status.'}
        </p>
      )}
      {shown.map((t) => (
        <TicketCard key={t.id} ticket={t} canManage={!!data?.canManage} agentId={agentId} projectId={projectId} />
      ))}
    </div>
  )
}

function TicketCard({ ticket, canManage, agentId, projectId }: Readonly<{ ticket: Ticket; canManage: boolean; agentId: string; projectId: string }>) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<Ticket['status']>(ticket.status)
  const [note, setNote] = useState(ticket.resolution_note ?? '')
  const save = useMutation({
    mutationFn: () => send(`/api/qa-audit/flags/${ticket.id}`, 'PATCH', { status, resolution_note: note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qa-audit', 'flags', agentId] }),
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{ticket.reason}</p>
        <StatusPill status={ticket.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Flagged {fmtDate(ticket.flagged_at)}{ticket.flagged_by_email ? ` by ${ticket.flagged_by_email}` : ''}</span>
        <a
          href={`/${projectId}/agents/${agentId}/observability?session_id=${ticket.call_log_id}`}
          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
        >
          Open the call <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {ticket.status === 'resolved' && ticket.resolution_note && (
        <p className="mt-3 rounded bg-gray-50 p-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <span className="font-medium">Resolution: </span>{ticket.resolution_note}
          {ticket.resolved_at && <span className="text-xs text-gray-400"> — {fmtDate(ticket.resolved_at)}</span>}
        </p>
      )}
      {canManage && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as Ticket['status'])}>
              <option value="pending">Pending</option>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
            </select>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
            {save.isError && <span className="text-xs text-red-600">{(save.error as Error).message}</span>}
          </div>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (required to mark resolved)" />
        </div>
      )}
    </div>
  )
}

function WeeklyReview({ agentId }: Readonly<{ agentId: string }>) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery<{ reviews: Review[]; canManage: boolean; suggestedWeek: { weekStart: string; weekEnd: string } }>({
    queryKey: ['qa-audit', 'weekly', agentId],
    queryFn: async () => {
      const res = await fetch(`/api/qa-audit/weekly?agentId=${agentId}`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not load weekly reviews')
      return res.json()
    },
  })
  const request = useMutation({
    mutationFn: () => send('/api/qa-audit/weekly', 'POST', { agentId, weekStart: data?.suggestedWeek.weekStart }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qa-audit', 'weekly', agentId] }),
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>

  const reviews = data?.reviews ?? []
  const week = data?.suggestedWeek
  const alreadyAsked = !!week && reviews.some((r) => r.week_start === week.weekStart)

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Review last week&apos;s calls</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {week ? fmtWeek(week.weekStart, week.weekEnd) : ''}. The QA team reviews the whole week and shares a Google Sheet here.
          </p>
        </div>
        <Button onClick={() => request.mutate()} disabled={request.isPending || alreadyAsked || !week}>
          {alreadyAsked ? 'Already requested' : 'Request review'}
        </Button>
        {request.isError && <p className="w-full text-xs text-red-600">{(request.error as Error).message}</p>}
      </div>
      {reviews.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
          No weekly reviews requested yet.
        </p>
      )}
      {reviews.map((r) => <ReviewCard key={r.id} review={r} canManage={!!data?.canManage} agentId={agentId} />)}
    </div>
  )
}

function ReviewCard({ review, canManage, agentId }: Readonly<{ review: Review; canManage: boolean; agentId: string }>) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<Review['status']>(review.status)
  const [sheet, setSheet] = useState(review.sheet_url ?? '')
  const [note, setNote] = useState(review.note ?? '')
  const save = useMutation({
    mutationFn: () => send(`/api/qa-audit/weekly/${review.id}`, 'PATCH', { status, sheet_url: sheet, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qa-audit', 'weekly', agentId] }),
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Week of {fmtWeek(review.week_start, review.week_end)}</p>
        <StatusPill status={review.status} />
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Requested {fmtDate(review.requested_at)}{review.requested_by_email ? ` by ${review.requested_by_email}` : ''}
      </p>
      {review.status === 'ready' && review.sheet_url && (
        <a
          href={review.sheet_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          <FileSpreadsheet className="h-4 w-4" /> Open the review sheet <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {review.note && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{review.note}</p>}
      {canManage && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as Review['status'])}>
              <option value="requested">Requested</option>
              <option value="in_progress">In progress</option>
              <option value="ready">Ready</option>
            </select>
            <Input className="min-w-0 flex-1" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="Google Sheet link (needed for Ready)" />
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the customer (optional)" />
          {save.isError && <p className="text-xs text-red-600">{(save.error as Error).message}</p>}
        </div>
      )}
    </div>
  )
}
