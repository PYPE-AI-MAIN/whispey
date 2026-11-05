import { describe, it, expect } from 'vitest'
import { specsFor } from '@/hooks/useOrgOverview'

/**
 * Pickup % is a per-person rate. Both sides of the ratio must count distinct
 * phone numbers — a plain row count on either side lets retries skew it.
 */
describe('overview pickup specs', () => {
  const byId = new Map(specsFor({ days: 30 }).map((w) => [w.id, w.spec]))

  it.each(['unique_callees', 'picked_up_callees', 'callees_by_agent', 'picked_up_callees_by_agent'])(
    '%s counts distinct customer_number',
    (id) => {
      const spec = byId.get(id)
      expect(spec?.agg).toMatchObject({ fn: 'count_distinct', field: { col: 'customer_number' } })
    }
  )

  it('only the picked-up side filters on completed', () => {
    expect(byId.get('unique_callees')?.having).toBeUndefined()
    expect(byId.get('picked_up_callees')?.having).toEqual([
      { field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' },
    ])
  })
})
