import { describe, it, expect } from 'vitest'
import { buildAssistantSessionBehaviorPayload } from '@/hooks/useMultiAssistantState'

const withSession = (session: Record<string, unknown>) => ({ advancedSettings: { session } })

describe('eod_silence_seconds in the saved session_behavior', () => {
  it('is sent when set', () => {
    expect(buildAssistantSessionBehaviorPayload(withSession({ eod_silence_seconds: 5 })).eod_silence_seconds).toBe(5)
  })

  it('keeps 0 (hang up right after the goodbye) — it is a real value, not "empty"', () => {
    const payload = buildAssistantSessionBehaviorPayload(withSession({ eod_silence_seconds: 0 }))
    expect(payload).toHaveProperty('eod_silence_seconds', 0)
  })

  it('keeps a fractional value', () => {
    expect(buildAssistantSessionBehaviorPayload(withSession({ eod_silence_seconds: 1.5 })).eod_silence_seconds).toBe(1.5)
  })

  it('is left out when unset, so the backend default (3 s) applies', () => {
    expect(buildAssistantSessionBehaviorPayload(withSession({})).eod_silence_seconds).toBeUndefined()
    expect(buildAssistantSessionBehaviorPayload(withSession({ eod_silence_seconds: undefined }))).not.toHaveProperty('eod_silence_seconds')
    expect(buildAssistantSessionBehaviorPayload(withSession({ eod_silence_seconds: null }))).not.toHaveProperty('eod_silence_seconds')
  })

  it('does not disturb the neighbouring away-timeout fields', () => {
    const payload = buildAssistantSessionBehaviorPayload(
      withSession({ user_away_timeout: 7, user_away_timeout_max_count: 3, eod_silence_seconds: 2 }),
    )
    expect(payload.user_away_timeout).toBe(7)
    expect(payload.user_away_timeout_max_count).toBe(3)
    expect(payload.eod_silence_seconds).toBe(2)
  })
})
