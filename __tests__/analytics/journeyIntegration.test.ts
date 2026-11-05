import { describe, expect, it } from 'vitest'
import { eventSnippet } from '@/components/analytics/JourneyIntegrationGuide'

describe('journey integration snippets', () => {
  for (const lang of ['curl', 'python', 'javascript'] as const) {
    it(`${lang}: points at the events endpoint, sends the token header and every required field`, () => {
      const s = eventSnippet(lang, 'https://whispey.xyz', 'nhc_add_family')
      expect(s).toContain('https://whispey.xyz/api/journeys/events')
      expect(s).toContain('x-pype-token')
      for (const f of ['campaign_key', 'identity_key', 'channel', 'step', 'action']) expect(s).toContain(f)
      expect(s).toContain('nhc_add_family')
    })
  }

  it('the example body is accepted by the real request schema fields (all required names present once)', () => {
    const s = eventSnippet('curl', 'https://x', 'k')
    for (const f of ['campaign_key', 'identity_key', 'channel', 'step', 'action']) expect(s.split(`"${f}"`).length - 1).toBe(1)
  })
})
