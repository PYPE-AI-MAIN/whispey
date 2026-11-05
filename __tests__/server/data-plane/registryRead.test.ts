import { describe, it, expect, vi, beforeEach } from 'vitest'

const result = { current: { data: null as any, error: null as any } }
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({ from: () => ({ select: () => ({ eq: async () => result.current }) }) }),
}))

import { readRegistry, isMissingRegistryTable } from '@/server/data-plane/resolver'
import { DestinationUnavailable } from '@/server/data-plane/errors'

describe('readRegistry when the registry tables are not installed', () => {
  beforeEach(() => { result.current = { data: null, error: null } })

  it('treats a missing table as no routes, so every project stays on Pype', async () => {
    result.current = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.data_destination_routes' in the schema cache" } }
    await expect(readRegistry('p1')).resolves.toEqual([])
  })

  it('also accepts the Postgres 42P01 form', async () => {
    result.current = { data: null, error: { code: '42P01', message: 'relation "data_destination_routes" does not exist' } }
    await expect(readRegistry('p1')).resolves.toEqual([])
  })

  it('still fails closed on any other registry error', async () => {
    result.current = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }
    await expect(readRegistry('p1')).rejects.toBeInstanceOf(DestinationUnavailable)
  })

  it('returns the routes when the table exists', async () => {
    result.current = { data: [{ data_type: 'call_data' }], error: null }
    await expect(readRegistry('p1')).resolves.toEqual([{ data_type: 'call_data' }])
  })

  it('isMissingRegistryTable ignores unrelated errors', () => {
    expect(isMissingRegistryTable(null)).toBe(false)
    expect(isMissingRegistryTable({ code: '23505', message: 'duplicate key' })).toBe(false)
  })
})
