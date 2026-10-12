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
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ExternalLink, FileSpreadsheet, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
  sheet_url: string | null
  assignee_email: string | null
  comments: Comment[]
  events: FlagEvent[]
}

type FlagEvent = { id: string; kind: 'flagged' | 'status' | 'assigned'; actor_email: string | null; detail: string; created_at: string }

type Comment = { id: string; author_email: string; body: string; attachments: { key: string; name: string }[]; created_at: string }

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
const localDay = (d: string) => fmtDate(`${d}T00:00:00`)
const fmtWeek = (start: string, end: string) => `${localDay(start)} – ${localDay(end)}`

const fieldClass =
  'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
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
    <div className="w-full max-w-4xl">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>
      {action && <div className="mt-5">{action}</div>}
      <div className="mt-8">{children}</div>
    </div>
  )
}

function Empty({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-sm leading-relaxed text-gray-600 dark:border-gray-700 dark:text-gray-400">
      {children}
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

const TABS = [
  { id: 'flagged', label: 'Flagged calls' },
  { id: 'weekly', label: 'Weekly review' },
] as const

export default function QaAuditPanel({ agentId, projectId }: Readonly<{ agentId: string; projectId: string }>) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('flagged')
  return (
    <div className="flex h-full flex-col">
      <div role="tablist" className="flex flex-none items-end gap-8 border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900 md:px-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 py-3.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-6 pb-12 pt-8 md:px-8">
        {tab === 'flagged' ? <FlaggedCalls agentId={agentId} projectId={projectId} /> : <WeeklyReview agentId={agentId} />}
      </div>
    </div>
  )
}

type FlagsPage = {
  tickets: Ticket[]
  total: number
  page: number
  pageSize: number
  counts: Record<Ticket['status'], number>
  canManage: boolean
  internal: boolean
}

function FlaggedCalls({ agentId, projectId }: Readonly<{ agentId: string; projectId: string }>) {
  const [filter, setFilter] = useState<'all' | Ticket['status']>('all')
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useQuery<FlagsPage>({
    queryKey: ['qa-audit', 'flags', agentId, filter, page],
    queryFn: () => load(`/api/qa-audit/flags?agentId=${agentId}&page=${page}${filter === 'all' ? '' : `&status=${filter}`}`, 'flagged calls'),
    placeholderData: keepPreviousData,
  })
  const { data: team } = useQuery<{ engineers: { name: string; email: string }[] }>({
    queryKey: ['qa-audit', 'team', agentId],
    queryFn: () => load(`/api/qa-audit/team?agentId=${agentId}`, 'the team'),
    enabled: !!data?.canManage,
  })

  const tickets = data?.tickets ?? []
  const counts = data?.counts
  const all = counts ? counts.pending + counts.in_review + counts.resolved : 0
  const lastPage = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 25)))
  const from = tickets.length ? ((data?.page ?? 1) - 1) * (data?.pageSize ?? 25) + 1 : 0
  const pick = (s: 'all' | Ticket['status']) => {
    setFilter(s)
    setPage(1)
  }

  let body: ReactNode
  if (isLoading) body = <Skeleton className="h-40 w-full rounded-xl" />
  else if (error) body = <p className="text-sm text-red-600">{(error as Error).message}</p>
  else if (tickets.length === 0) {
    body = (
      <Empty>
        {all === 0 ? (
          <>
            Nothing has been flagged for this agent. Open{' '}
            <a href={`/${projectId}/agents/${agentId}?tab=logs`} className="font-medium text-gray-900 underline underline-offset-2 dark:text-gray-100">Call Logs</a>{' '}
            and flag a call, and it shows up here for the QA team.
          </>
        ) : 'No tickets with this status.'}
      </Empty>
    )
  } else {
    body = (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5">Flag</th>
                <th className="px-4 py-2.5">Flagged by</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Status</th>
                {data?.internal && <th className="px-4 py-2.5">Assigned to</th>}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {tickets.map((t) => (
                <TicketRow key={t.id} ticket={t} canManage={!!data?.canManage} internal={!!data?.internal} engineers={team?.engineers ?? []} agentId={agentId} projectId={projectId} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <span className="tabular-nums">{from}–{from + tickets.length - 1} of {data?.total}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {page} of {lastPage}</span>
            <Button size="sm" variant="outline" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Section title="Flagged calls" hint="Calls flagged from the call logs. The QA team reviews each one and records how it was resolved.">
      <div className="mb-4 flex gap-5 text-sm">
        {(['all', 'pending', 'in_review', 'resolved'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => pick(s)}
            className={filter === s ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}
          >
            {s === 'all' ? 'All' : STATUS_LABEL[s]} <span className="tabular-nums text-gray-400">{s === 'all' ? all : (counts?.[s] ?? 0)}</span>
          </button>
        ))}
      </div>
      {body}
    </Section>
  )
}

function TicketRow({ ticket, canManage, internal, engineers, agentId, projectId }: Readonly<{ ticket: Ticket; canManage: boolean; internal: boolean; engineers: { name: string; email: string }[]; agentId: string; projectId: string }>) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<Ticket['status']>(ticket.status)
  const [note, setNote] = useState(ticket.resolution_note ?? '')
  const [sheet, setSheet] = useState(ticket.sheet_url ?? '')
  const [assignee, setAssignee] = useState(ticket.assignee_email ?? '')
  const save = useMutation({
    mutationFn: () => send(`/api/qa-audit/flags/${ticket.id}`, 'PATCH', { status, resolution_note: note, sheet_url: sheet, assignee_email: assignee }),
    onSuccess: () => {
      setEditing(false)
      return qc.invalidateQueries({ queryKey: ['qa-audit', 'flags', agentId] })
    },
  })
  const engineerName = (email: string | null) => engineers.find((e) => e.email === email)?.name ?? email

  return (
    <>
      <tr onClick={() => setOpen(!open)} className="cursor-pointer align-top hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <td className="max-w-xs px-4 py-3 font-medium text-gray-900 dark:text-gray-100"><span className="line-clamp-2">{ticket.reason}</span></td>
        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{ticket.flagged_by_email ?? '—'}</td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(ticket.flagged_at)}</td>
        <td className="px-4 py-3"><StatusPill status={ticket.status} /></td>
        {internal && <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{engineerName(ticket.assignee_email) ?? '—'}</td>}
        <td className="px-2 py-3 text-gray-400"><ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /></td>
      </tr>
      {open && (
        <tr className="bg-gray-50/50 dark:bg-gray-800/20">
          <td colSpan={internal ? 6 : 5} className="px-4 pb-4 pt-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <a
                href={`/${projectId}/agents/${agentId}/observability?session_id=${ticket.call_log_id}`}
                className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Open call <ExternalLink className="h-3 w-3" />
              </a>
              {internal && ticket.sheet_url && (
                <a href={ticket.sheet_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400">
                  <FileSpreadsheet className="h-3 w-3" /> Internal sheet
                </a>
              )}
              {canManage && !editing && (
                <button type="button" onClick={() => setEditing(true)} className="font-medium text-gray-700 hover:underline dark:text-gray-300">Update</button>
              )}
            </div>
            {ticket.status === 'resolved' && ticket.resolution_note && (
              <p className="mt-3 border-l-2 border-emerald-500 pl-3 text-sm text-gray-700 dark:text-gray-300">
                {ticket.resolution_note}
                {ticket.resolved_at && <span className="ml-2 text-xs text-gray-400">{fmtDate(ticket.resolved_at)}</span>}
              </p>
            )}
            <Thread ticket={ticket} canManage={canManage} agentId={agentId} />
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
                <Labelled label="Prompt engineer (emailed and tagged on Slack when in review)">
                  <select className={fieldClass} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">Nobody</option>
                    {engineers.map((e) => <option key={e.email} value={e.email}>{e.name}</option>)}
                  </select>
                </Labelled>
                <Labelled label="Internal sheet link (only Pype staff see this)">
                  <Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/…" />
                </Labelled>
              </Editor>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

const imageSrc = (key: string) => `/api/qa-audit/attachments?key=${encodeURIComponent(key)}`

/** Comments from the QA team (visible to the customer too); the QA team gets a box to add one at any status. */
function Thread({ ticket, canManage, agentId }: Readonly<{ ticket: Ticket; canManage: boolean; agentId: string }>) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [images, setImages] = useState<{ key: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setErr('')
    try {
      for (const file of Array.from(files).slice(0, 5 - images.length)) {
        const form = new FormData()
        form.append('ticketId', ticket.id)
        form.append('file', file)
        const res = await fetch('/api/qa-audit/attachments', { method: 'POST', body: form })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'Upload failed')
        setImages((prev) => [...prev, json])
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const post = useMutation({
    mutationFn: () => send(`/api/qa-audit/flags/${ticket.id}/comments`, 'POST', { body: text, attachments: images }),
    onSuccess: () => {
      setText('')
      setImages([])
      return qc.invalidateQueries({ queryKey: ['qa-audit', 'flags', agentId] })
    },
  })

  const journey: { at: string; event?: FlagEvent; comment?: Comment }[] = [
    ...ticket.events.map((e) => ({ at: e.created_at, event: e })),
    ...ticket.comments.map((c) => ({ at: c.created_at, comment: c })),
  ].sort((a, b) => a.at.localeCompare(b.at))
  const eventText = (e: FlagEvent) =>
    e.kind === 'flagged' ? `Flagged: ${e.detail}` : e.kind === 'assigned' ? e.detail : `Status: ${e.detail.split(' -> ').map((s) => STATUS_LABEL[s] ?? s).join(' → ')}`

  if (!canManage && journey.length === 0) return null
  return (
    <div className="mt-3 space-y-3">
      {journey.map(({ event, comment: c }) => event ? (
        <p key={event.id} className="text-xs text-gray-500 dark:text-gray-400">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
          {eventText(event)} · {fmtDate(event.created_at)}
        </p>
      ) : c && (
        <div key={c.id} className="border-l-2 border-blue-500 pl-3 text-sm text-gray-700 dark:text-gray-300">
          {c.body && <p className="whitespace-pre-wrap">{c.body}</p>}
          {c.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.attachments.map((a) => (
                <a key={a.key} href={imageSrc(a.key)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageSrc(a.key)} alt={a.name} className="h-24 rounded-md border border-gray-200 object-cover dark:border-gray-700" />
                </a>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-400">QA team · {fmtDate(c.created_at)}</p>
        </div>
      ))}
      {canManage && (
        <div className="space-y-2">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment (the customer sees it)" />
          {images.length > 0 && <p className="text-xs text-gray-500">{images.map((i) => i.name).join(', ')}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => post.mutate()} disabled={post.isPending || uploading || (!text.trim() && images.length === 0)}>
              {post.isPending ? 'Posting…' : 'Comment'}
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-gray-600 hover:underline dark:text-gray-400">
              <ImagePlus className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Attach image'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = '' }} />
            </label>
            {(err || post.isError) && <span className="text-xs text-red-600">{err || (post.error as Error).message}</span>}
          </div>
        </div>
      )}
    </div>
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
  else if (reviews.length === 0) body = <Empty>No weekly reviews yet. Request last week above, and the QA team will share the results here as a Google Sheet.</Empty>
  else body = <RowList>{reviews.map((r) => <ReviewRow key={r.id} review={r} canManage={!!data?.canManage} agentId={agentId} />)}</RowList>

  return (
    <Section
      title="Weekly review"
      hint={week ? `Ask the QA team to review every call from ${fmtWeek(week.weekStart, week.weekEnd)}. They share the results as a Google Sheet.` : 'Ask the QA team to review a whole week of calls.'}
      action={
        <div className="flex flex-wrap items-center gap-3">
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
