/**
 * Tell the QA team on Slack when a customer flags a call or asks for a weekly review.
 *
 * Best effort and never throws: the flag / request is already saved, and a Slack
 * problem must not turn that into an error for the customer.
 *
 * Needs QA_SLACK_WEBHOOK_URL (a Slack incoming webhook) and, so the link works,
 * NEXT_PUBLIC_APP_URL.
 */

type QaAlert = {
  kind: 'flag' | 'weekly'
  agentName: string
  agentId: string
  projectId: string
  byEmail: string
  /** The flag reason, or the week being reviewed. */
  detail: string
}

// Slack treats & < > as control characters in message text.
const slackEscape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export function qaSlackText(a: QaAlert, appUrl: string): string {
  const link = `${appUrl}/${a.projectId}/agents/${a.agentId}/qa`
  const what = a.kind === 'flag' ? 'Call flagged' : 'Weekly review requested'
  const label = a.kind === 'flag' ? 'Reason' : 'Week'
  return [
    `*${what}* on *${slackEscape(a.agentName)}*`,
    `By: ${slackEscape(a.byEmail || 'unknown')}`,
    `${label}: ${slackEscape(a.detail)}`,
    `<${link}|Open QA Audit>`,
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
      body: JSON.stringify({ text: qaSlackText(a, process.env.NEXT_PUBLIC_APP_URL ?? '') }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('QA Slack alert failed:', res.status, await res.text())
  } catch (e) {
    console.error('QA Slack alert failed:', e instanceof Error ? e.message : e)
  }
}
