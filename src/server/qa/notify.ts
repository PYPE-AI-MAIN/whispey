/**
 * Tell the QA team on Slack when a customer flags a call or asks for a weekly review.
 *
 * Best effort and never throws: the flag / request is already saved, and a Slack
 * problem must not turn that into an error for the customer.
 *
 * Needs QA_SLACK_WEBHOOK_URL (a Slack incoming webhook) and, so the links work,
 * NEXT_PUBLIC_APP_URL. QA_SLACK_MENTION optionally tags someone: Slack webhooks
 * cannot look up @names, so it is the member's ID written like <@U0123ABCD>
 * (Slack: profile > More > Copy member ID).
 */

import { createServiceRoleClient } from '@/lib/supabase-server'

type QaAlert = {
  kind: 'flag' | 'weekly'
  agentName: string
  agentId: string
  projectId: string
  byEmail: string
  /** Flags only: the call that was flagged. */
  callLogId?: string
  /** The flag reason, or the week being reviewed. */
  detail: string
}

// Slack treats & < > as control characters in message text.
const slackEscape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

// Only a real Slack mention (<@U123>, <!subteam^S123>) may be injected from config.
const MENTION_RE = /^<[@!][A-Za-z0-9^|._-]+>$/

export function qaSlackText(a: QaAlert, appUrl: string, mention = ''): string {
  const agentUrl = `${appUrl}/${a.projectId}/agents/${a.agentId}`
  const what = a.kind === 'flag' ? 'Call flagged' : 'Weekly review requested'
  const label = a.kind === 'flag' ? 'Reason' : 'Week'
  const tag = MENTION_RE.test(mention) ? `${mention} ` : ''
  const links = [
    a.callLogId ? `<${agentUrl}/observability?session_id=${a.callLogId}|Open call>` : '',
    `<${agentUrl}/qa|Open QA Audit>`,
  ].filter(Boolean).join('  |  ')
  return [
    `${tag}*${what}* on <${agentUrl}|${slackEscape(a.agentName)}>`,
    `By: ${slackEscape(a.byEmail || 'unknown')}`,
    `${label}: ${slackEscape(a.detail)}`,
    links,
  ].join('\n')
}

export async function notifyQaTeam(a: QaAlert): Promise<void> {
  try {
    const db = createServiceRoleClient()
    const { data } = await db.from('qa_team_members').select('email').eq('role', 'qa')
    const team = new Set([
      ...(data ?? []).map((m) => m.email),
      ...(process.env.QA_TEAM_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) ?? []),
    ])
    const what = a.kind === 'flag' ? `Call flagged by ${a.byEmail || 'a customer'}` : `Weekly review requested by ${a.byEmail || 'a customer'}`
    if (team.size) {
      await db.from('qa_inbox').insert([...team].map((email) => ({
        recipient_email: email,
        title: `${a.agentName}: ${what}`,
        body: a.detail,
        link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${a.projectId}/agents/${a.agentId}/qa`,
      })))
    }
  } catch (e) {
    console.error('QA team bell notification failed:', e instanceof Error ? e.message : e)
  }
  try {
    const url = process.env.QA_SLACK_WEBHOOK_URL
    if (!url) {
      console.warn('QA Slack alert skipped: QA_SLACK_WEBHOOK_URL is not set')
      return
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: qaSlackText(a, process.env.NEXT_PUBLIC_APP_URL ?? '', process.env.QA_SLACK_MENTION ?? '') }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('QA Slack alert failed:', res.status, await res.text())
  } catch (e) {
    console.error('QA Slack alert failed:', e instanceof Error ? e.message : e)
  }
}

type QaStatusAlert = {
  kind: 'flag' | 'weekly'
  agentName: string
  agentId: string
  projectId: string
  /** The customer who flagged / requested; gets the email. */
  clientEmail: string
  /** The customer behind the ticket, when `clientEmail` is someone else (the prompt engineer). */
  flaggedBy?: string | null
  /** The QA team member who made the change. */
  byEmail: string
  callLogId?: string
  /** What changed, e.g. "Flagged call -> Resolved". */
  detail: string
  note?: string | null
  sheetUrl?: string | null
  /** Post to Slack too (only when a ticket is passed to a prompt engineer). */
  slack?: boolean
  /** Slack member ID to tag in that alert, e.g. U0AJMAJ5694. */
  slackId?: string | null
}

async function postToSlack(a: QaStatusAlert, link: string): Promise<void> {
  const url = process.env.QA_SLACK_WEBHOOK_URL
  if (!a.slack || !url) return
  const tag = a.slackId && /^[UW][A-Z0-9]{6,}$/.test(a.slackId) ? `<@${a.slackId}> ` : ''
  const extra = [a.note && `Note: ${a.note}`, a.sheetUrl && `Sheet: ${a.sheetUrl}`].filter(Boolean) as string[]
  const text = [
    `${tag}*QA update* on <${link.replace('/qa', '')}|${slackEscape(a.agentName)}>: ${slackEscape(a.detail)}`,
    `By: ${slackEscape(a.byEmail || 'unknown')}  |  Client: ${slackEscape(a.flaggedBy || a.clientEmail || 'unknown')}`,
    ...extra.map(slackEscape),
    `<${link}|Open QA Audit>`,
  ].join('\n')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) console.error('QA status Slack alert failed:', res.status, await res.text())
}

async function addBellItem(a: QaStatusAlert, link: string): Promise<void> {
  if (!a.clientEmail) return
  await createServiceRoleClient().from('qa_inbox').insert({
    recipient_email: a.clientEmail.toLowerCase(),
    title: `${a.agentName}: ${a.detail}`,
    body: a.note ?? null,
    link,
  })
}

async function sendEmail(a: QaStatusAlert, link: string): Promise<void> {
  const transactionalId = process.env.QA_STATUS_LOOPS_TEMPLATE_ID
  if (!a.clientEmail || !transactionalId || !process.env.LOOPS_API_KEY) {
    console.warn('QA status email skipped: no client email, QA_STATUS_LOOPS_TEMPLATE_ID or LOOPS_API_KEY')
    return
  }
  const res = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.LOOPS_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionalId,
      email: a.clientEmail,
      dataVariables: { agentName: a.agentName, update: a.detail, note: a.note ?? '', sheetUrl: a.sheetUrl ?? '', link },
      addToAudience: false,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) console.error('QA status email failed:', res.status, await res.text())
}

/**
 * Tell one person about a ticket update: an in-app bell item and an email (Loops
 * transactional, template QA_STATUS_LOOPS_TEMPLATE_ID with variables agentName,
 * update, note, sheetUrl, link). Slack is posted only when `slack` is set, which is
 * the hand-off to a prompt engineer. Best effort, never throws.
 */
export async function notifyQaStatusChange(a: QaStatusAlert): Promise<void> {
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${a.projectId}/agents/${a.agentId}/qa`
  const steps = [postToSlack, addBellItem, sendEmail]
  for (const step of steps) {
    try {
      await step(a, link)
    } catch (e) {
      console.error(`QA ${step.name} failed:`, e instanceof Error ? e.message : e)
    }
  }
}

/** Append one step to a ticket's journey (flagged, status change, assignment). Best effort. */
export async function logQaEvent(ticketId: string, kind: 'flagged' | 'status' | 'assigned', actorEmail: string, detail: string): Promise<void> {
  try {
    await createServiceRoleClient().from('qa_flag_events').insert({ ticket_id: ticketId, kind, actor_email: actorEmail || null, detail })
  } catch (e) {
    console.error('QA event log failed:', e instanceof Error ? e.message : e)
  }
}
