import { describe, it, expect, vi } from 'vitest'

// Stable mock reference that survives any module re-load
const mockHasValidServiceToken = vi.hoisted(() => vi.fn())

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (fn: any) => fn, // expose inner handler as default export
  createRouteMatcher: () => (_req: any) => false, // all routes are "protected"
}))

vi.mock('@/lib/serviceTokenVerifier', () => ({
  hasValidServiceToken: mockHasValidServiceToken,
}))

import middleware from '@/middleware'

const makeReq = (pathname: string, authHeader?: string) => ({
  nextUrl: { pathname },
  headers: { get: (h: string) => (h === 'Authorization' ? (authHeader ?? null) : null) },
})

describe('middleware', () => {
  it('returns early for /playground routes without calling protect', async () => {
    const auth = { protect: vi.fn() }
    await (middleware as any)(auth, makeReq('/proj/playground'))
    expect(auth.protect).not.toHaveBeenCalled()
  })

  it('calls auth.protect when no valid service token on a protected route', async () => {
    mockHasValidServiceToken.mockResolvedValue(false)
    const auth = { protect: vi.fn() }
    await (middleware as any)(auth, makeReq('/dashboard/private'))
    expect(auth.protect).toHaveBeenCalled()
  })

  it('skips auth.protect when a valid service token is present', async () => {
    mockHasValidServiceToken.mockResolvedValue(true)
    const auth = { protect: vi.fn() }
    await (middleware as any)(auth, makeReq('/dashboard/private', 'Bearer valid-token'))
    expect(auth.protect).not.toHaveBeenCalled()
  })
})
