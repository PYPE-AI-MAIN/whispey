import { describe, it, expect } from 'vitest'
import { VapiDataTransformer } from '@/lib/vapi-data-transformer'

// extractPhoneNumber is private — accessed via a cast since TS privacy is
// compile-time only. A full public-API test would need an entire synthetic
// webhook payload just to exercise this one branch, which is exactly the
// thing this file's own comments (customer_number garbling, dashboard-call
// vs. phone-call branches) suggest was too easy to get wrong by hand.
describe('VapiDataTransformer.extractPhoneNumber (webCall branch)', () => {
  const transformer = new VapiDataTransformer('dev') as any

  it('builds a `web-call-{id}` identifier when the dashboard call has an id', () => {
    const result = transformer.extractPhoneNumber({ call: { type: 'webCall', id: 'abc-123' } })
    expect(result).toBe('web-call-abc-123')
  })

  it('falls back to "unknown-webcall" when the dashboard call has no id', () => {
    // This is the branch a constant-truthy `||` used to hide: a template
    // literal is always truthy, so `web-call-undefined` was silently
    // returned instead of this fallback ever running.
    const result = transformer.extractPhoneNumber({ call: { type: 'webCall' } })
    expect(result).toBe('unknown-webcall')
  })
})
