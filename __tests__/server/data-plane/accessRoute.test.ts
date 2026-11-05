import { describe, it, expect, vi, beforeEach } from 'vitest'

const guard = vi.fn()
vi.mock('@/server/admin/requirePlatformAdmin', () => ({ requirePlatformAdmin: () => guard() }))

import { GET } from '@/app/api/admin/data-destinations/access/route'

describe('GET /api/admin/data-destinations/access', () => {
  beforeEach(() => guard.mockReset())

  it('true for a platform admin', async () => {
    guard.mockResolvedValue({ email: 'a@pypeai.com' })
    expect(await (await GET()).json()).toEqual({ isDataAdmin: true })
  })

  it('false for a signed-in user who is not an admin', async () => {
    guard.mockResolvedValue({ response: new Response(null, { status: 403 }) })
    expect(await (await GET()).json()).toEqual({ isDataAdmin: false })
  })

  it('false when signed out', async () => {
    guard.mockResolvedValue({ response: new Response(null, { status: 401 }) })
    expect(await (await GET()).json()).toEqual({ isDataAdmin: false })
  })
})
