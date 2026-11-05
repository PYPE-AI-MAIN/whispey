import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadTranscriptJson } from '@/lib/transcriptExport'

// The download runs in the browser: capture the file it builds instead.
let saved: { name: string; blob: Blob } | null
let clicked: boolean

beforeEach(() => {
  saved = null
  clicked = false
  const link: any = { click: () => { clicked = true }, remove: vi.fn() }
  vi.stubGlobal('document', {
    createElement: () => link,
    body: { appendChild: (el: any) => { saved = { name: el.download, blob: blobs.get(el.href)! } } },
  })
  const blobs = new Map<string, Blob>()
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b: any) => { blobs.set('blob:1', b); return 'blob:1' })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const exported = async () => JSON.parse(await saved!.blob.text())

describe('downloadTranscriptJson', () => {
  it('does nothing for an empty transcript', () => {
    downloadTranscriptJson([], 'session-1', 'agent-1')
    expect(saved).toBeNull()
    expect(clicked).toBe(false)
  })

  it('saves the turns as JSON, named after the session', async () => {
    downloadTranscriptJson([
      {
        turn_id: '1',
        user_transcript: '  hello  ',
        agent_response: ' hi there ',
        unix_timestamp: 1_700_000_000,
        trace_id: 'tr-1',
        tool_calls: [
          { tool_name: 'slot_fetch', arguments: { date: '2026-10-14' }, result: { slots: [] }, latency_ms: 120 },
          { name: 'book_slot', status: 'error', error: 'busy' },
          {},
        ],
      },
      { turn_id: '2', user_transcript: '   ', agent_response: null },
    ], 'abcdef1234567890', 'agent-1')

    expect(clicked).toBe(true)
    expect(saved!.name).toMatch(/^transcript-session-34567890-.+\.json$/)
    const data = await exported()
    expect(data).toMatchObject({ session_id: 'abcdef1234567890', agent_id: 'agent-1', total_turns: 2 })
    expect(data.turns[0]).toEqual({
      turn_id: '1',
      user: 'hello',
      assistant: 'hi there',
      timestamp: new Date(1_700_000_000 * 1000).toISOString(),
      trace_id: 'tr-1',
      tool_calls: [
        { name: 'slot_fetch', arguments: { date: '2026-10-14' }, result: { slots: [] }, success: true, latency_ms: 120 },
        { name: 'book_slot', success: false, error: 'busy' },
        { name: 'unknown', success: true },
      ],
    })
    // blank text is left out rather than exported as empty strings
    expect(data.turns[1]).toEqual({ turn_id: '2' })
  })

  it('falls back to "unknown" without a session id', async () => {
    downloadTranscriptJson([{ turn_id: '1', agent_response: 'hi' }], undefined, 'agent-1')
    expect(saved!.name).toMatch(/^transcript-session-unknown-/)
    expect((await exported()).session_id).toBe('unknown')
  })
})
