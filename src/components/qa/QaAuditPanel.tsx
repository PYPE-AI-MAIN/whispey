'use client'

/**
 * QA Audit — two tabs.
 *
 * Flagged calls: every call a customer flagged becomes a ticket here, with its
 * reason and where the QA team has got to (pending → in review → resolved).
 * Weekly review: the customer asks for a whole finished week of calls to be
 * reviewed; the QA team attaches the Google Sheet and it shows up as a link.
 *
 * The QA team (see server/qa/access.ts) gets an Update control on each row;
 * everyone else sees the same rows read-only.
 */
import { useState, type ReactNode } from 'react'
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
// text colour + dot colour per status
const STATUS_TONE: Record<string, { text: string; dot: string }> = {
  pending: { text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  requested: { text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  in_review: { text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  in_progress: { text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  resolved: { text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  ready: { text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const fmtWeek = (start: string, end: string) => `${fmtDate(`${start}T00:00:00`)} – ${fmtDate(`${end}T00:00:00`)}`

const fieldClass =
  'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
const tabClass =
  'h-11 flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 text-sm font-medium text-gray-500 shadow-none data-[state=active]:border-gray-900 data-[state=active]:bg-transparent data-[state=active]:text-gray-900 data-[state=active]:shadow-none dark:text-gray-400 dark:data-[state=active]:border-gray-100 dark:data-[state=active]:text-gray-100'

function StatusPill({ status }: Readonly<{ status: string }>) {
  const tone = STATUS_TONE[status]
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 text-xs font-medium ${tone?.text ?? ''}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone?.dot ?? 'bg-gray-400'}`} />
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

async function load<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Could not load ${what}`)
  return res.json()
}

function Section({ title, hint, action, children }: Readonly<{ title: string; hint: string; action?: ReactNode; children: ReactNode }>) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Empty({ icon, text }: Readonly<{ icon: ReactNode; text: string }>) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 px-6 py-14 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
      <span className="text-gray-400">{icon}</span>
      {text}
    </div>
  )
}

/** One bordered list; rows are separated by hairlines instead of each being a card. */
function RowList({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
      {children}
    </ul>
  )
}

function Editor({ children, onSave, saving, error }: Readonly<{ children: ReactNode; onSave: () => void; saving: boolean; error?: string }>) {
  return (
    <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
      {children}
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}

function Labelled({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      {children}
    </label>
  )
}

export default function QaAuditPanel({ agentId, projectId }: Readonly<{ agentId: string; projectId: string }>) {
  return (
    <Tabs defaultValue="flagged" className="flex h-full flex-col gap-0">
      <div className="flex-none border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900 md:px-8">
        <TabsList className="h-11 gap-6 bg-transparent p-0">
          <TabsTrigger value="flagged" className={tabClass}><Flag className="h-4 w-4" /> Flagged calls</TabsTrigger>
          <TabsTrigger value="weekly" className={tabClass}><CalendarCheck className="h-4 w-4" /> Weekly review</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="flagged" className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-8">
        <FlaggedCalls agentId={agentId} projectId={projectId} />
      </TabsContent>
      <TabsContent value="weekly" className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-8">
        <WeeklyReview agentId={agentId} />
      </TabsContent>
    </Tabs>
  )
}

function FlaggedCalls({ agentId, projectId }: Readonly<{ agentId: string; projectId: string }>) {
  const [filter, setFilter] = useState<'all' | Ticket['status']>('all')
  const { data, isLoading, error } = useQuery<{ tickets: Ticket[]; canManage: boolean }>({
    queryKey: ['qa-audit', 'flags', agentId],
    queryFn: () => load(`/api/qa-audit/flags?agentId=${agentId}`, 'flagged calls'),
  })

  const tickets = data?.tickets ?? []
  const shown = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter)
  const count = (s: string) => tickets.filter((t) => t.status === s).length

  let body: ReactNode
  if (isLoading) body = <Skeleton className="h-40 w-full rounded-xl" />
  else if (error) body = <p className="text-sm text-red-600">{(error as Error).message}</p>
  else if (shown.length === 0) {
    body = <Empty icon={<Flag className="h-6 w-6" />} text={tickets.length === 0 ? 'No flagged calls yet. Flag a call from the call logs and it will appear here.' : 'Nothing in this status.'} />
  } else {
    body = (
      <RowList>
        {shown.map((t) => <TicketRow key={t.id} ticket={t} canManage={!!data?.canManage} agentId={agentId} projectId={projectId} />)}
      </RowList>
    )
  }

  return (
    <Section title="Flagged calls" hint="Calls flagged from the call logs. The QA team reviews each one and records how it was resolved.">
      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-800">
        {(['all', 'pending', 'in_review', 'resolved'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              filter === s
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABEL[s]} <span className="opacity-60">{s === 'all' ? tickets.length : count(s)}</span>
          </button>
        ))}
      </div>
      {body}
    </Section>
  )
}

function TicketRow({ ticket, canManage, agentId, projectId }: Readonly<{ ticket: Ticket; canManage: boolean; agentId: string; projectId: string }>) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<Ticket['status']>(ticket.status)
  const [note, setNote] = useState(ticket.resolution_note ?? '')
  const save = useMutation({
    mutationFn: () => send(`/api/qa-audit/flags/${ticket.id}`, 'PATCH', { status, resolution_note: note }),
    onSuccess: () => {
      setEditing(false)
      return qc.invalidateQueries({ queryKey: ['qa-audit', 'flags', agentId] })
    },
  })

  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{ticket.reason}</p>
        <StatusPill status={ticket.status} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>{fmtDate(ticket.flagged_at)}</span>
        {ticket.flagged_by_email && <span>{ticket.flagged_by_email}</span>}
        <a
          href={`/${projectId}/agents/${agentId}/observability?session_id=${ticket.call_log_id}`}
          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Open call <ExternalLink className="h-3 w-3" />
        </a>
        {canManage && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="font-medium text-gray-700 hover:underline dark:text-gray-300">
            Update
          </button>
        )}
      </div>
      {ticket.status === 'resolved' && ticket.resolution_note && (
        <p className="mt-3 border-l-2 border-emerald-500 pl-3 text-sm text-gray-700 dark:text-gray-300">
          {ticket.resolution_note}
          {ticket.resolved_at && <span className="ml-2 text-xs text-gray-400">{fmtDate(ticket.resolved_at)}</span>}
        </p>
      )}
      {canManage && editing && (
        <Editor onSave={() => save.mutate()} saving={save.isPending} error={save.isError ? (save.error as Error).message : undefined}>
          <Labelled label="Status">
            <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value as Ticket['status'])}>
              <option value="pending">Pending</option>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
            </select>
          </Labelled>
          <Labelled label="Resolution note (required to resolve)">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Labelled>
        </Editor>
      )}
    </li>
  )
}

function WeeklyReview({ agentId }: Readonly<{ agentId: string }>) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery<{ reviews: Review[]; canManage: boolean; suggestedWeek: { weekStart: string; weekEnd: string } }>({
    queryKey: ['qa-audit', 'weekly', agentId],
    queryFn: () => load(`/api/qa-audit/weekly?agentId=${agentId}`, 'weekly reviews'),
  })
  const request = useMutation({
    mutationFn: () => send('/api/qa-audit/weekly', 'POST', { agentId, weekStart: data?.suggestedWeek.weekStart }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qa-audit', 'weekly', agentId] }),
  })

  const reviews = data?.reviews ?? []
  const week = data?.suggestedWeek
  const alreadyAsked = !!week && reviews.some((r) => r.week_start === week.weekStart)

  let body: ReactNode
  if (isLoading) body = <Skeleton className="h-40 w-full rounded-xl" />
  else if (error) body = <p className="text-sm text-red-600">{(error as Error).message}</p>
  else if (reviews.length === 0) body = <Empty icon={<CalendarCheck className="h-6 w-6" />} text="No weekly reviews yet. Request one for last week and the QA team will share a sheet here." />
  else body = <RowList>{reviews.map((r) => <ReviewRow key={r.id} review={r} canManage={!!data?.canManage} agentId={agentId} />)}</RowList>

  return (
    <Section
      title="Weekly review"
      hint={week ? `Ask the QA team to review every call from ${fmtWeek(week.weekStart, week.weekEnd)}. They share the results as a Google Sheet.` : 'Ask the QA team to review a whole week of calls.'}
      action={
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => request.mutate()} disabled={request.isPending || alreadyAsked || !week}>
            {alreadyAsked ? 'Requested for last week' : 'Request last week’s review'}
          </Button>
          {request.isError && <span className="text-xs text-red-600">{(request.error as Error).message}</span>}
        </div>
      }
    >
      {body}
    </Section>
  )
}

function ReviewRow({ review, canManage, agentId }: Readonly<{ review: Review; canManage: boolean; agentId: string }>) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<Review['status']>(review.status)
  const [sheet, setSheet] = useState(review.sheet_url ?? '')
  const [note, setNote] = useState(review.note ?? '')
  const save = useMutation({
    mutationFn: () => send(`/api/qa-audit/weekly/${review.id}`, 'PATCH', { status, sheet_url: sheet, note }),
    onSuccess: () => {
      setEditing(false)
      return qc.invalidateQueries({ queryKey: ['qa-audit', 'weekly', agentId] })
    },
  })

  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{fmtWeek(review.week_start, review.week_end)}</p>
        <StatusPill status={review.status} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Requested {fmtDate(review.requested_at)}{review.requested_by_email ? ` by ${review.requested_by_email}` : ''}</span>
        {review.status === 'ready' && review.sheet_url && (
          <a
            href={review.sheet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Open sheet <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {canManage && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="font-medium text-gray-700 hover:underline dark:text-gray-300">
            Update
          </button>
        )}
      </div>
      {review.note && <p className="mt-3 border-l-2 border-gray-300 pl-3 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">{review.note}</p>}
      {canManage && editing && (
        <Editor onSave={() => save.mutate()} saving={save.isPending} error={save.isError ? (save.error as Error).message : undefined}>
          <Labelled label="Status">
            <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value as Review['status'])}>
              <option value="requested">Requested</option>
              <option value="in_progress">In progress</option>
              <option value="ready">Ready</option>
            </select>
          </Labelled>
          <Labelled label="Google Sheet link (required for Ready)">
            <Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/…" />
          </Labelled>
          <Labelled label="Note for the customer (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Labelled>
        </Editor>
      )}
    </li>
  )
}
