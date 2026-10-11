/**
 * QA Audit — shared rules for flagged-call tickets and weekly reviews.
 * Pure functions, no I/O: the API routes call these and the tests pin them.
 */

export const TICKET_STATUSES = ['pending', 'in_review', 'resolved'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const WEEKLY_STATUSES = ['requested', 'in_progress', 'ready'] as const
export type WeeklyStatus = (typeof WEEKLY_STATUSES)[number]

const SHEET_HOSTS = new Set(['docs.google.com', 'drive.google.com'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

type Check<T> = { error: string } | { patch: T }

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function dayMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

/** Today's calendar date in the given time zone, as YYYY-MM-DD. */
export function todayIn(now: Date, timeZone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Monday..Sunday of the most recent week that has fully ended. */
export function lastFullWeek(now: Date, timeZone = 'Asia/Kolkata'): { weekStart: string; weekEnd: string } {
  const today = dayMs(todayIn(now, timeZone))
  const sinceMonday = (new Date(today).getUTCDay() + 6) % 7
  const thisMonday = today - sinceMonday * DAY_MS
  return { weekStart: ymd(thisMonday - 7 * DAY_MS), weekEnd: ymd(thisMonday - DAY_MS) }
}

/** A week may be requested once it is over: a real date, a Monday, ending before today. */
export function weekError(weekStart: unknown, now: Date, timeZone = 'Asia/Kolkata'): string | null {
  if (typeof weekStart !== 'string' || !DATE_RE.test(weekStart) || Number.isNaN(dayMs(weekStart))) {
    return 'weekStart must be a date like 2026-10-05'
  }
  if (new Date(dayMs(weekStart)).getUTCDay() !== 1) return 'weekStart must be a Monday'
  if (dayMs(weekStart) + 7 * DAY_MS > dayMs(todayIn(now, timeZone))) return 'That week has not finished yet'
  return null
}

export function weekEndOf(weekStart: string): string {
  return ymd(dayMs(weekStart) + 6 * DAY_MS)
}

/** Only a Google Sheets / Drive link over https: the sheet is shown to customers as a link. */
export function sheetUrlError(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return 'Sheet link is required'
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return 'Sheet link is not a valid URL'
  }
  if (parsed.protocol !== 'https:' || !SHEET_HOSTS.has(parsed.hostname)) {
    return 'Use a Google Sheets link (docs.google.com or drive.google.com)'
  }
  return null
}

function cleanNote(note: unknown): string | null {
  return typeof note === 'string' && note.trim() ? note.trim().slice(0, 2000) : null
}

export type TicketPatch = { status: TicketStatus; resolution_note: string | null }

export function ticketPatch(body: Record<string, unknown>): Check<TicketPatch> {
  const status = body.status
  if (!TICKET_STATUSES.includes(status as TicketStatus)) return { error: 'Invalid status' }
  const resolution_note = cleanNote(body.resolution_note)
  if (status === 'resolved' && !resolution_note) return { error: 'Add a resolution note before resolving' }
  return { patch: { status: status as TicketStatus, resolution_note } }
}

export type WeeklyPatch = { status: WeeklyStatus; sheet_url?: string; note: string | null }

export function weeklyPatch(body: Record<string, unknown>): Check<WeeklyPatch> {
  const status = body.status
  if (!WEEKLY_STATUSES.includes(status as WeeklyStatus)) return { error: 'Invalid status' }
  const note = cleanNote(body.note)
  if (status !== 'ready') return { patch: { status: status as WeeklyStatus, note } }
  const error = sheetUrlError(body.sheet_url)
  if (error) return { error }
  return { patch: { status: 'ready', sheet_url: (body.sheet_url as string).trim(), note } }
}
