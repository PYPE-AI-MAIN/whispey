import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const {
  mockAuth,
  mockGetCallerGlobalRole,
  mockSingle,
  mockSelect,
  mockInsert,
  mockOrder,
  mockEq,
  mockFrom,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetCallerGlobalRole: vi.fn(),
  mockSingle: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockOrder: vi.fn(),
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mockAuth }))
vi.mock('@/lib/prod-auth', () => ({ getCallerGlobalRole: mockGetCallerGlobalRole }))
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

import { GET, POST } from '@/app/api/admin/metrics-templates/route'

// ── Helpers ────────────────────────────────────────────────────────────────
function makeRequest(body?: object) {
  return new Request('http://localhost/api/admin/metrics-templates', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any
}

function setupChain(result: { data: unknown; error: unknown; count?: number }) {
  mockSingle.mockResolvedValue(result)
  mockOrder.mockResolvedValue(result)
  mockEq.mockReturnValue({ single: mockSingle, order: mockOrder })
  mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq, single: mockSingle })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert })
}

const TEMPLATE = {
  metric_id: 'call_quality',
  name: 'Call Quality',
  description: 'Evaluates call quality',
  default_criteria: 'Score the call quality from 0 to 1',
  default_scoring_mode: 'continuous',
  default_threshold: 0.7,
  category: 'quality',
  priority: 'high',
  is_active: true,
}

// ── GET /api/admin/metrics-templates ──────────────────────────────────────
describe('GET /api/admin/metrics-templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not superadmin', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    mockGetCallerGlobalRole.mockResolvedValue('user')
    const res = await GET()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 when user is prompter (not superadmin)', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    mockGetCallerGlobalRole.mockResolvedValue('prompter')
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns all templates including inactive when superadmin', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupChain({ data: [TEMPLATE, { ...TEMPLATE, metric_id: 'old_metric', is_active: false }], error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body.some((t: any) => t.is_active === false)).toBe(true)
  })

  it('returns 500 when supabase returns an error', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupChain({ data: null, error: { message: 'connection timeout' } })
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('queries the correct table', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupChain({ data: [], error: null })
    await GET()
    expect(mockFrom).toHaveBeenCalledWith('pype_voice_metrics_templates')
  })
})

// ── POST /api/admin/metrics-templates ─────────────────────────────────────
describe('POST /api/admin/metrics-templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const res = await POST(makeRequest(TEMPLATE))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not superadmin', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    mockGetCallerGlobalRole.mockResolvedValue('user')
    const res = await POST(makeRequest(TEMPLATE))
    expect(res.status).toBe(403)
  })

  it('returns 400 when metric_id is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    const { metric_id, ...withoutId } = TEMPLATE
    const res = await POST(makeRequest(withoutId))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing/i)
  })

  it('returns 400 when name is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    const { name, ...withoutName } = TEMPLATE
    const res = await POST(makeRequest(withoutName))
    expect(res.status).toBe(400)
  })

  it('returns 400 when default_criteria is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    const { default_criteria, ...withoutCriteria } = TEMPLATE
    const res = await POST(makeRequest(withoutCriteria))
    expect(res.status).toBe(400)
  })

  it('returns 400 when default_scoring_mode is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    const { default_scoring_mode, ...withoutMode } = TEMPLATE
    const res = await POST(makeRequest(withoutMode))
    expect(res.status).toBe(400)
  })

  it('returns 400 when default_scoring_mode is invalid', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    const res = await POST(makeRequest({ ...TEMPLATE, default_scoring_mode: 'invalid_mode' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when metric_id already exists (duplicate)', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupChain({ data: null, error: { code: '23505', message: 'duplicate key value' } })
    const res = await POST(makeRequest(TEMPLATE))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already exists/i)
  })

  it('returns 201 with created template on success', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupChain({ data: { ...TEMPLATE, is_active: true }, error: null })
    const res = await POST(makeRequest(TEMPLATE))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.metric_id).toBe('call_quality')
    expect(body.is_active).toBe(true)
  })

  it('defaults threshold to 0.7 when not provided', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    const { default_threshold, ...withoutThreshold } = TEMPLATE
    setupChain({ data: { ...withoutThreshold, default_threshold: 0.7, is_active: true }, error: null })
    const res = await POST(makeRequest(withoutThreshold))
    expect(res.status).toBe(201)
  })

  it('inserts into the correct table', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupChain({ data: { ...TEMPLATE, is_active: true }, error: null })
    await POST(makeRequest(TEMPLATE))
    expect(mockFrom).toHaveBeenCalledWith('pype_voice_metrics_templates')
    expect(mockInsert).toHaveBeenCalled()
  })

  it('returns 500 on unexpected supabase error', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_123' })
    mockGetCallerGlobalRole.mockResolvedValue('superadmin')
    setupChain({ data: null, error: { code: '500', message: 'internal db error' } })
    const res = await POST(makeRequest(TEMPLATE))
    expect(res.status).toBe(500)
  })
})
