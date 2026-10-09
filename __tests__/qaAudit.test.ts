import { describe, expect, it } from 'vitest'
import { lastFullWeek, sheetUrlError, ticketPatch, weekEndOf, weekError, weeklyPatch } from '@/lib/qaAudit'

// Thu 8 Oct 2026, 10:00 IST
const NOW = new Date('2026-10-08T04:30:00Z')

describe('weeks', () => {
  it('suggests the last finished Monday–Sunday', () => {
    expect(lastFullWeek(NOW)).toEqual({ weekStart: '2026-09-28', weekEnd: '2026-10-04' })
  })
  it('uses the calendar day in IST, not UTC', () => {
    // Mon 5 Oct 00:30 IST is still Sun 4 Oct in UTC
    expect(lastFullWeek(new Date('2026-10-04T19:00:00Z')).weekStart).toBe('2026-09-28')
    expect(lastFullWeek(new Date('2026-10-05T19:00:00Z')).weekStart).toBe('2026-09-28')
    expect(lastFullWeek(new Date('2026-10-11T19:00:00Z')).weekStart).toBe('2026-10-05')
  })
  it('only accepts finished Mondays', () => {
    expect(weekError('2026-09-28', NOW)).toBeNull()
    expect(weekError('2026-09-29', NOW)).toMatch(/Monday/)
    expect(weekError('2026-10-05', NOW)).toMatch(/not finished/)
    expect(weekError('nope', NOW)).toMatch(/date/)
    expect(weekError(undefined, NOW)).toMatch(/date/)
  })
  it('week end is the Sunday', () => {
    expect(weekEndOf('2026-09-28')).toBe('2026-10-04')
  })
})

describe('sheet link', () => {
  it('accepts Google Sheets and Drive over https only', () => {
    expect(sheetUrlError('https://docs.google.com/spreadsheets/d/abc/edit')).toBeNull()
    expect(sheetUrlError('https://drive.google.com/file/d/abc')).toBeNull()
    expect(sheetUrlError('http://docs.google.com/spreadsheets/d/abc')).not.toBeNull()
    expect(sheetUrlError('https://evil.example.com/x')).not.toBeNull()
    expect(sheetUrlError('https://docs.google.com.evil.com/x')).not.toBeNull()
    expect(sheetUrlError('javascript:alert(1)')).not.toBeNull()
    expect(sheetUrlError('')).not.toBeNull()
  })
})

describe('ticket patch', () => {
  it('needs a note to resolve', () => {
    expect(ticketPatch({ status: 'resolved' })).toEqual({ error: 'Add a resolution note before resolving' })
    expect(ticketPatch({ status: 'resolved', resolution_note: ' fixed ' })).toEqual({ patch: { status: 'resolved', resolution_note: 'fixed' } })
  })
  it('rejects unknown status', () => {
    expect(ticketPatch({ status: 'done' })).toEqual({ error: 'Invalid status' })
  })
  it('moves to in review without a note', () => {
    expect(ticketPatch({ status: 'in_review' })).toEqual({ patch: { status: 'in_review', resolution_note: null } })
  })
})

describe('weekly patch', () => {
  it('ready needs a Google Sheet link', () => {
    expect(weeklyPatch({ status: 'ready' })).toEqual({ error: 'Sheet link is required' })
    expect(weeklyPatch({ status: 'ready', sheet_url: 'https://docs.google.com/spreadsheets/d/x' })).toEqual({
      patch: { status: 'ready', sheet_url: 'https://docs.google.com/spreadsheets/d/x', note: null },
    })
  })
  it('in progress keeps whatever sheet was attached', () => {
    expect(weeklyPatch({ status: 'in_progress', sheet_url: 'ignored' })).toEqual({ patch: { status: 'in_progress', note: null } })
  })
})

describe('slack alert', () => {
  const base = { kind: 'flag' as const, agentName: 'Bot', agentId: 'a1', projectId: 'p1', byEmail: 'x@y.com', detail: 'rude <b>&</b>', callLogId: 'c9' }
  it('links the agent, the call and the QA page, and escapes Slack control characters', async () => {
    const { qaSlackText } = await import('@/server/qa/notify')
    const text = qaSlackText(base, 'https://app.example.com')
    expect(text).toContain('<https://app.example.com/p1/agents/a1|Bot>')
    expect(text).toContain('<https://app.example.com/p1/agents/a1/observability?session_id=c9|Open call>')
    expect(text).toContain('<https://app.example.com/p1/agents/a1/qa|Open QA Audit>')
    expect(text).toContain('rude &lt;b&gt;&amp;&lt;/b&gt;')
    expect(text).toContain('Call flagged')
  })
  it('tags someone only when the mention is a real Slack mention', async () => {
    const { qaSlackText } = await import('@/server/qa/notify')
    expect(qaSlackText(base, 'https://a.com', '<@U0123ABCD>').startsWith('<@U0123ABCD> *Call flagged*')).toBe(true)
    expect(qaSlackText(base, 'https://a.com', 'hello <!channel>').startsWith('*Call flagged*')).toBe(true)
    expect(qaSlackText(base, 'https://a.com', '').startsWith('*Call flagged*')).toBe(true)
  })
  it('labels a weekly request and has no call link', async () => {
    const { qaSlackText } = await import('@/server/qa/notify')
    const text = qaSlackText({ ...base, kind: 'weekly', callLogId: undefined, detail: '2026-09-28 to 2026-10-04' }, '')
    expect(text).toContain('Week: 2026-09-28 to 2026-10-04')
    expect(text).not.toContain('Open call')
  })
})
