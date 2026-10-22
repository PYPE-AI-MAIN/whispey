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
  pending: { text: 'text-warning', dot: 'bg-amber-500' },
  requested: { text: 'text-warning', dot: 'bg-amber-500' },
  in_review: { text: 'text-primary', dot: 'bg-blue-500' },
  in_progress: { text: 'text-primary', dot: 'bg-blue-500' },
  resolved: { text: 'text-success', dot: 'bg-emerald-500' },
  ready: { text: 'text-success', dot: 'bg-emerald-500' },
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const localDay = (d: string) => fmtDate(`${d}T00:00:00`)
const fmtWeek = (start: string, end: string) => `${localDay(start)} – ${localDay(end)}`

const fieldClass =
  'h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-border'
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
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{hint}</p>
      {action && <div className="mt-5">{action}</div>}
      <div className="mt-8">{children}</div>
    </div>
  )
}

function Empty({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  )
}

/** One bordered list; rows are separated by hairlines instead of each being a card. */
function RowList({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {children}
    </ul>
  )
}

function Editor({ children, onSave, saving, error }: Readonly<{ children: ReactNode; onSave: () => void; saving: boolean; error?: string }>) {
  return (
    <div className="mt-3 space-y-3 rounded-lg bg-muted/50 p-3">
      {children}
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}

function Labelled({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
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
      <div role="tablist" className="flex flex-none items-end gap-8 border-b border-border bg-card px-6 md:px-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 py-3.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-gray-900 text-foreground dark:border-gray-100'
                : 'border-transparent text-muted-foreground hover:text-foreground'
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
    queryFn: () => {
      const statusParam = filter === 'all' ? '' : `&status=${filter}`
      return load(`/api/qa-audit/flags?agentId=${agentId}&page=${page}${statusParam}`, 'flagged calls')
    },
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
  else if (error) body = <p className="text-sm text-destructive">{(error as Error).message}</p>
  else if (tickets.length === 0) {
    body = (
      <Empty>
        {all === 0 ? (
          <>
            Nothing has been flagged for this agent. Open{' '}
            <a href={`/${projectId}/agents/${agentId}?tab=logs`} className="font-medium text-foreground underline underline-offset-2">Call Logs</a>{' '}
            and flag a call, and it shows up here for the QA team.
          </>
        ) : 'No tickets with this status.'}
      </Empty>
    )
  } else {
    body = (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Flag</th>
                <th className="px-4 py-2.5">Flagged by</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Status</th>
                {data?.internal && <th className="px-4 py-2.5">Assigned to</th>}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((t) => (
                <TicketRow key={t.id} ticket={t} canManage={!!data?.canManage} internal={!!data?.internal} engineers={team?.engineers ?? []} agentId={agentId} projectId={projectId} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
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
            className={filter === s ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}
          >
            {s === 'all' ? 'All' : STATUS_LABEL[s]} <span className="tabular-nums text-muted-foreground">{s === 'all' ? all : (counts?.[s] ?? 0)}</span>
          </button>
        ))}
      </div>
      {body}
    </Section>
  )
}

function TicketRow({ ticket, canManage, internal, engineers, agentId, projectId }: Readonly<{ ticket: Ticket; canManage: boolean; internal: boolean; engineers: { name: string; email: string }[]; agentId: string; projectId: string }>) {
  const [open, setOpen] = useState(false)
  const engineerName = (email: string | null) => engineers.find((e) => e.email === email)?.name ?? email

  return (
    <>
      <tr onClick={() => setOpen(!open)} className="cursor-pointer align-top hover:bg-muted/50">
        <td className="max-w-xs px-4 py-3 font-medium text-foreground"><span className="line-clamp-2">{ticket.reason}</span></td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{ticket.flagged_by_email ?? '—'}</td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{fmtDate(ticket.flagged_at)}</td>
        <td className="px-4 py-3"><StatusPill status={ticket.status} /></td>
        {internal && <td className="px-4 py-3 text-xs text-muted-foreground">{engineerName(ticket.assignee_email) ?? '—'}</td>}
        <td className="px-2 py-3 text-muted-foreground"><ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /></td>
      </tr>
      {open && (
        <tr className="bg-muted/50">
          <td colSpan={internal ? 6 : 5} className="px-4 pb-4 pt-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <a
                href={`/${projectId}/agents/${agentId}/observability?session_id=${ticket.call_log_id}`}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Open call <ExternalLink className="h-3 w-3" />
              </a>
              {internal && ticket.sheet_url && (
                <a href={ticket.sheet_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  <FileSpreadsheet className="h-3 w-3" /> Internal sheet
                </a>
              )}
            </div>
            {ticket.status === 'resolved' && ticket.resolution_note && !ticket.comments.some((c) => c.body === ticket.resolution_note) && (
              <p className="mt-3 border-l-2 border-emerald-500 pl-3 text-sm text-foreground">{ticket.resolution_note}</p>
            )}
            <Thread ticket={ticket} />
            {canManage && <Composer ticket={ticket} engineers={engineers} agentId={agentId} />}
          </td>
        </tr>
      )}
    </>
  )
}

const imageSrc = (key: string) => `/api/qa-audit/attachments?key=${encodeURIComponent(key)}`

/** What has happened to this flag so far: flagged, status changes, hand-offs and every comment, oldest first. */
function Thread({ ticket }: Readonly<{ ticket: Ticket }>) {
  const journey: { at: string; event?: FlagEvent; comment?: Comment }[] = [
    ...ticket.events.map((e) => ({ at: e.created_at, event: e })),
    ...ticket.comments.map((c) => ({ at: c.created_at, comment: c })),
  ].sort((a, b) => a.at.localeCompare(b.at))
  const eventText = (e: FlagEvent) => {
    if (e.kind === 'flagged') return `Flagged: ${e.detail}`
    if (e.kind === 'assigned') return e.detail
    return `Status: ${e.detail.split(' -> ').map((s) => STATUS_LABEL[s] ?? s).join(' → ')}`
  }

  if (journey.length === 0) return null
  return (
    <div className="mt-3 space-y-3">
      {journey.map(({ event, comment: c }) => event ? (
        <p key={event.id} className="text-xs text-muted-foreground">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          {eventText(event)} · {fmtDate(event.created_at)}
        </p>
      ) : c && (
        <div key={c.id} className="border-l-2 border-blue-500 pl-3 text-sm text-foreground">
          {c.body && <p className="whitespace-pre-wrap">{c.body}</p>}
          {c.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.attachments.map((a) => (
                <a key={a.key} href={imageSrc(a.key)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageSrc(a.key)} alt={a.name} className="h-24 rounded-md border border-border object-cover" />
                </a>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">QA team · {fmtDate(c.created_at)}</p>
        </div>
      ))}
    </div>
  )
}

const STATUS_HINT: Record<Ticket['status'], string> = {
  pending: 'Not started. The customer sees nothing new until you comment or change the status.',
  in_review: 'Passes it to the prompt engineer: they get an email and a Slack tag. Pick who, and attach the sheet if you have one.',
  resolved: 'Write what was done. The customer sees it and gets an email.',
}

/** QA team only: the one place to reply, change the status, and hand off. One Send does it all. */
function Composer({ ticket, engineers, agentId }: Readonly<{ ticket: Ticket; engineers: { name: string; email: string }[]; agentId: string }>) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [images, setImages] = useState<{ key: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [status, setStatus] = useState<Ticket['status']>(ticket.status)
  const [assignee, setAssignee] = useState(ticket.assignee_email ?? '')
  const [sheet, setSheet] = useState(ticket.sheet_url ?? '')

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

  const hasMessage = !!text.trim() || images.length > 0
  const statusChanged = status !== ticket.status
  const changed = statusChanged || assignee !== (ticket.assignee_email ?? '') || sheet.trim() !== (ticket.sheet_url ?? '')
  const needsNote = status === 'resolved' && !text.trim() && !ticket.resolution_note
  const submit = useMutation({
    mutationFn: () =>
      changed
        ? send(`/api/qa-audit/flags/${ticket.id}`, 'PATCH', {
            status,
            resolution_note: status === 'resolved' ? text.trim() || ticket.resolution_note : ticket.resolution_note,
            sheet_url: sheet,
            assignee_email: assignee,
            comment: { body: text, attachments: images },
          })
        : send(`/api/qa-audit/flags/${ticket.id}/comments`, 'POST', { body: text, attachments: images }),
    onSuccess: () => {
      setText('')
      setImages([])
      return qc.invalidateQueries({ queryKey: ['qa-audit', 'flags', agentId] })
    },
  })

  let label = 'Send'
  if (statusChanged) label = `Send and move to ${STATUS_LABEL[status]}`
  else if (!hasMessage) label = 'Save changes'

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-card p-3">
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={status === 'resolved' ? 'What was done? (required, the customer sees this)' : 'Write a comment (the customer sees it)'}
      />
      {images.length > 0 && <p className="text-xs text-muted-foreground">Attached: {images.map((i) => i.name).join(', ')}</p>}
      <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:underline">
        <ImagePlus className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Attach image'}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = '' }} />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <Labelled label="Status">
          <select className={`${fieldClass} w-40`} value={status} onChange={(e) => setStatus(e.target.value as Ticket['status'])}>
            <option value="pending">Pending</option>
            <option value="in_review">In review</option>
            <option value="resolved">Resolved</option>
          </select>
        </Labelled>
        {status === 'in_review' && (
          <>
            <Labelled label="Prompt engineer">
              <select className={`${fieldClass} w-44`} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Choose…</option>
                {engineers.map((e) => <option key={e.email} value={e.email}>{e.name}</option>)}
              </select>
            </Labelled>
            <Labelled label="Internal sheet (Pype staff only)">
              <Input className="w-64" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/…" />
            </Labelled>
          </>
        )}
        <Button size="sm" onClick={() => submit.mutate()} disabled={submit.isPending || uploading || needsNote || (!hasMessage && !changed)}>
          {submit.isPending ? 'Sending…' : label}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{STATUS_HINT[status]}</p>
      {(err || submit.isError) && <p className="text-xs text-destructive">{err || (submit.error as Error).message}</p>}
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
  else if (error) body = <p className="text-sm text-destructive">{(error as Error).message}</p>
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
          {request.isError && <span className="text-xs text-destructive">{(request.error as Error).message}</span>}
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
        <p className="text-sm font-medium text-foreground">{fmtWeek(review.week_start, review.week_end)}</p>
        <StatusPill status={review.status} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Requested {fmtDate(review.requested_at)}{review.requested_by_email ? ` by ${review.requested_by_email}` : ''}</span>
        {review.status === 'ready' && review.sheet_url && (
          <a
            href={review.sheet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Open sheet <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {canManage && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="font-medium text-foreground hover:underline">
            Update
          </button>
        )}
      </div>
      {review.note && <p className="mt-3 border-l-2 border-border pl-3 text-sm text-foreground">{review.note}</p>}
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
