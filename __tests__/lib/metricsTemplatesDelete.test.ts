import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const {
  mockAuth,
  mockGetCallerGlobalRole,
  mockDelete,
  mockEq,
  mockFrom,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetCallerGlobalRole: vi.fn(),
  mockDelete: vi.fn(),
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mockAuth }))
vi.mock('@/lib/prod-auth', () => ({ getCallerGlobalRole: mockGetCallerGlobalRole }))
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

import { DELETE } from '@/app/api/admin/metrics-templates/[id]/route'

// ── Helpers ────────────────────────────────────────────────────────────────
function makeRequest() {
  return new Request('http://localhost/api/admin/metrics-templates/call_quality', {
    method: 'DELETE',
  }) as any
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function setupDeleteChain(result: { error: unknown; count: number }) {
  mockEq.mockResolvedValue(result)
  mockDelete.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ delete: mockDelete })
}

// ── DELETE /api/admin/metrics-templates/[id] ───────────────────────────────
describe('DELETE /api/admin/metrics-templates/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const res = await DELETE(makeRequest(), makeParams('call_quality'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not superadmin', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    mockGetCallerGlobalRole.mockResolvedValue('user')
    const res = await DELETE(makeRequest(), makeParams('call_quality'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 when user is prompter', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    mockGetCallerGlobalRole.mockResolvedValue('prompter')
    const res = await DELETE(makeRequest(), makeParams('call_quality'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when template does not exist', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupDeleteChain({ error: null, count: 0 })
    const res = await DELETE(makeRequest(), makeParams('nonexistent_metric'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Template not found')
  })

  it('returns 200 with success true on successful delete', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupDeleteChain({ error: null, count: 1 })
    const res = await DELETE(makeRequest(), makeParams('call_quality'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when supabase returns an error', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupDeleteChain({ error: { message: 'db error' }, count: 0 })
    const res = await DELETE(makeRequest(), makeParams('call_quality'))
    expect(res.status).toBe(500)
  })

  it('deletes by metric_id from the correct table', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupDeleteChain({ error: null, count: 1 })
    await DELETE(makeRequest(), makeParams('call_quality'))
    expect(mockFrom).toHaveBeenCalledWith('pype_voice_metrics_templates')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('metric_id', 'call_quality')
  })

  it('handles different metric_id values correctly', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupDeleteChain({ error: null, count: 1 })
    await DELETE(makeRequest(), makeParams('is_task_complete'))
    expect(mockEq).toHaveBeenCalledWith('metric_id', 'is_task_complete')
  })
})
