import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUserProjectRole, canViewApiKeys, canManageApiKeys } from '@/services/getUserRole'

beforeEach(() => { vi.restoreAllMocks() })

describe('canViewApiKeys', () => {
  it('returns true for owner', () => expect(canViewApiKeys('owner')).toBe(true))
  it('returns true for admin', () => expect(canViewApiKeys('admin')).toBe(true))
  it('returns false for viewer', () => expect(canViewApiKeys('viewer')).toBe(false))
  it('returns false for member', () => expect(canViewApiKeys('member')).toBe(false))
  it('returns false for empty string', () => expect(canViewApiKeys('')).toBe(false))
})

describe('canManageApiKeys', () => {
  it('returns true for owner', () => expect(canManageApiKeys('owner')).toBe(true))
  it('returns true for admin', () => expect(canManageApiKeys('admin')).toBe(true))
  it('returns false for viewer', () => expect(canManageApiKeys('viewer')).toBe(false))
  it('returns false for user', () => expect(canManageApiKeys('user')).toBe(false))
})

describe('getUserProjectRole', () => {
  it('returns role from successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ role: 'admin', permissions: { visibility: 'full' } }),
    }))
    const result = await getUserProjectRole('u@e.com', 'proj-1')
    expect(result.role).toBe('admin')
    expect(result.permissions).toEqual({ visibility: 'full' })
  })

  it('normalizes viewer/member/user roles to viewer', async () => {
    for (const role of ['user', 'member', 'viewer']) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ role, permissions: null }),
      }))
      const result = await getUserProjectRole('u@e.com', 'proj-1')
      expect(result.role).toBe('viewer')
    }
  })

  it('returns default role on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve(null) }))
    const result = await getUserProjectRole('u@e.com', 'proj-1')
    expect(result.role).toBe('user')
    expect(result.permissions).toBeNull()
  })

  it('returns default role on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await getUserProjectRole('u@e.com', 'proj-1')
    expect(result.role).toBe('user')
  })

  it('returns default role when json() throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('bad json')),
    }))
    const result = await getUserProjectRole('u@e.com', 'proj-1')
    expect(result.role).toBe('user')
  })
})
