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
  const links = [
    a.callLogId ? `<${agentUrl}/observability?session_id=${a.callLogId}|Open call>` : '',
    `<${agentUrl}/qa|Open QA Audit>`,
  ].filter(Boolean).join('  |  ')
  return [
    `${MENTION_RE.test(mention) ? `${mention} ` : ''}*${what}* on <${agentUrl}|${slackEscape(a.agentName)}>`,
    `By: ${slackEscape(a.byEmail || 'unknown')}`,
    `${label}: ${slackEscape(a.detail)}`,
    links,
  ].join('\n')
}

export async function notifyQaTeam(a: QaAlert): Promise<void> {
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
