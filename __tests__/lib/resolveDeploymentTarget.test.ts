import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const { mockAuth, mockGetCallerGlobalRole } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetCallerGlobalRole: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mockAuth }))
vi.mock('@/lib/prod-auth', () => ({ getCallerGlobalRole: mockGetCallerGlobalRole }))

import { resolveDeploymentTarget, resolveDeploymentTargetForUser } from '@/lib/resolveDeploymentTarget'

describe('resolveDeploymentTarget', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockGetCallerGlobalRole.mockReset()
  })

  it("returns 'classic' when the requested target is not 'docker'", async () => {
    expect(await resolveDeploymentTarget('classic')).toBe('classic')
    expect(await resolveDeploymentTarget(undefined)).toBe('classic')
    expect(await resolveDeploymentTarget(null)).toBe('classic')
    expect(await resolveDeploymentTarget('anything-else')).toBe('classic')
    expect(mockAuth).not.toHaveBeenCalled()
  })

  it("returns 'docker' when requested and the caller is a superadmin", async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    expect(await resolveDeploymentTarget('docker')).toBe('docker')
    expect(mockGetCallerGlobalRole).toHaveBeenCalledWith('user_123')
  })

  it("downgrades to 'classic' when the caller is not a superadmin", async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    mockGetCallerGlobalRole.mockResolvedValue('user')
    expect(await resolveDeploymentTarget('docker')).toBe('classic')
  })

  it("downgrades to 'classic' when there is no authenticated user", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    expect(await resolveDeploymentTarget('docker')).toBe('classic')
    expect(mockGetCallerGlobalRole).not.toHaveBeenCalled()
  })
})

describe('resolveDeploymentTargetForUser', () => {
  beforeEach(() => {
    mockGetCallerGlobalRole.mockReset()
  })

  it("returns 'classic' without checking role when the requested target is not 'docker'", async () => {
    expect(await resolveDeploymentTargetForUser('classic', 'user_123')).toBe('classic')
    expect(mockGetCallerGlobalRole).not.toHaveBeenCalled()
  })

  it("returns 'docker' for a superadmin with a known userId", async () => {
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    expect(await resolveDeploymentTargetForUser('docker', 'user_123')).toBe('docker')
    expect(mockGetCallerGlobalRole).toHaveBeenCalledWith('user_123')
  })

  it("downgrades to 'classic' for a non-superadmin", async () => {
    mockGetCallerGlobalRole.mockResolvedValue('user')
    expect(await resolveDeploymentTargetForUser('docker', 'user_123')).toBe('classic')
  })

  it("downgrades to 'classic' when userId is null/undefined", async () => {
    expect(await resolveDeploymentTargetForUser('docker', null)).toBe('classic')
    expect(await resolveDeploymentTargetForUser('docker', undefined)).toBe('classic')
    expect(mockGetCallerGlobalRole).not.toHaveBeenCalled()
  })
})
