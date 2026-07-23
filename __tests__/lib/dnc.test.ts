import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mutable state the mocked Supabase/Clerk read from (hoisted so vi.mock can see it).
const h = vi.hoisted(() => ({
  state: {
    rows: [] as any[],       // returned by an awaited query (checkDncNumbers)
    error: null as any,
    userRow: null as any,    // returned by .single() (getSuperAdminEmail)
    userId: 'user-1' as string | null,
    email: 'admin@example.com' as string | undefined,
  },
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const chain: any = {}
      chain.select = () => chain
      chain.eq = () => chain
      chain.in = () => chain
      chain.or = () => chain
      chain.single = () => Promise.resolve({ data: h.state.userRow, error: h.state.error })
      chain.then = (resolve: any, reject?: any) =>
        Promise.resolve({ data: h.state.rows, error: h.state.error }).then(resolve, reject)
      return chain
    },
  }),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => Promise.resolve({ userId: h.state.userId }),
  currentUser: () =>
    Promise.resolve(h.state.email ? { emailAddresses: [{ emailAddress: h.state.email }] } : null),
}))

import { normalizePhone, toNumbersArray, buildDncRows, checkDncNumbers, getSuperAdminEmail } from '@/lib/dnc'

beforeEach(() => {
  h.state.rows = []
  h.state.error = null
  h.state.userRow = null
  h.state.userId = 'user-1'
  h.state.email = 'admin@example.com'
})

// ── normalizePhone ────────────────────────────────────────────────────────────

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+919876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['00919876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+1 (555) 123-4567', '+15551234567'],
  ])('normalizes %s -> %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected)
  })

  it.each(['', 'abc', '12345', '1234567'])('returns null for %s', (raw) => {
    expect(normalizePhone(raw)).toBeNull()
  })

  it('honors a custom default country code', () => {
    expect(normalizePhone('5551234567', '1')).toBe('+15551234567')
  })
})

// ── toNumbersArray ────────────────────────────────────────────────────────────

describe('toNumbersArray', () => {
  it('passes arrays through', () => {
    expect(toNumbersArray(['a', 'b'])).toEqual(['a', 'b'])
  })
  it('wraps a single string', () => {
    expect(toNumbersArray('a')).toEqual(['a'])
  })
  it('returns [] for null/undefined', () => {
    expect(toNumbersArray(null)).toEqual([])
    expect(toNumbersArray(undefined)).toEqual([])
  })
})

// ── buildDncRows ──────────────────────────────────────────────────────────────

describe('buildDncRows', () => {
  const meta = { scope: 'global' as const, projectId: null, reason: 'r', source: 'manual', addedBy: 'me' }

  it('normalizes, dedupes, and flags invalid inputs', () => {
    const { rows, invalid } = buildDncRows(['9876543210', '09876543210', 'junk'], meta)
    expect(rows).toHaveLength(1) // the two spellings collapse to one E.164
    expect(rows[0].phone_e164).toBe('+919876543210')
    expect(rows[0].added_by).toBe('me')
    expect(invalid).toEqual(['junk'])
  })

  it('sets project_id only for project scope', () => {
    const { rows } = buildDncRows(['9876543210'], { ...meta, scope: 'project', projectId: 'p1' })
    expect(rows[0].project_id).toBe('p1')
    const g = buildDncRows(['9111111111'], meta)
    expect(g.rows[0].project_id).toBeNull()
  })
})

// ── checkDncNumbers ───────────────────────────────────────────────────────────

describe('checkDncNumbers', () => {
  it('flags globally blocked numbers', async () => {
    h.state.rows = [{ phone_e164: '+919876543210', scope: 'global', project_id: null }]
    const results = await checkDncNumbers(['9876543210', '9111111111'])
    expect(results.find((r) => r.input === '9876543210')?.blocked).toBe(true)
    expect(results.find((r) => r.input === '9111111111')?.blocked).toBe(false)
  })

  it('flags project-scoped numbers only for that project', async () => {
    h.state.rows = [{ phone_e164: '+919876543210', scope: 'project', project_id: 'p1' }]
    const results = await checkDncNumbers(['9876543210'], 'p1')
    expect(results[0].blocked).toBe(true)
    expect(results[0].scope).toBe('project')
  })

  it('treats unparseable numbers as not blocked and never queries', async () => {
    const results = await checkDncNumbers(['junk'])
    expect(results).toEqual([{ input: 'junk', normalized: null, blocked: false }])
  })

  it('throws when the query errors', async () => {
    h.state.error = { message: 'boom' }
    await expect(checkDncNumbers(['9876543210'])).rejects.toBeTruthy()
  })
})

// ── getSuperAdminEmail ────────────────────────────────────────────────────────

describe('getSuperAdminEmail', () => {
  it('returns the email for a global superadmin', async () => {
    h.state.userRow = { roles: { globalRole: 'superadmin' } }
    expect(await getSuperAdminEmail()).toBe('admin@example.com')
  })

  it('returns null for a non-superadmin', async () => {
    h.state.userRow = { roles: { globalRole: 'user' } }
    expect(await getSuperAdminEmail()).toBeNull()
  })

  it('returns null when unauthenticated', async () => {
    h.state.userId = null
    expect(await getSuperAdminEmail()).toBeNull()
  })
})
