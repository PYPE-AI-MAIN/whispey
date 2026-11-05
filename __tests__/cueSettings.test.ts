import { describe, it, expect } from 'vitest'
import { buildAssistantSessionBehaviorPayload } from '@/hooks/useMultiAssistantState'

const form = (session: Record<string, unknown>) => ({ advancedSettings: { session } })

describe('Cue as an agent turn detector', () => {
  it('saves the choice and the threshold with the rest of the session behaviour', () => {
    const payload = buildAssistantSessionBehaviorPayload(form({ turn_detection: 'cue', cue_threshold: 0.35 }))
    expect(payload.turn_detection).toBe('cue')
    expect(payload.cue_threshold).toBe(0.35)
  })

  it('leaves the threshold out when none was set, so the server default applies', () => {
    const payload = buildAssistantSessionBehaviorPayload(form({ turn_detection: 'cue' }))
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty('cue_threshold')
  })
})
