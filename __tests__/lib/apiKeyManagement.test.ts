import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock fns so they're available inside vi.mock factory
const { mockSingle, mockSelect, mockInsert, mockUpdate, mockEq, mockOrder, mockFrom } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockFrom: vi.fn(),
}))

// Mock supabase-server (called at module load time in api-key-management.ts)
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

import { generateApiToken, hashToken, maskToken, createProjectApiKey, getProjectApiKeys, updateKeyLastUsed } from '@/lib/api-key-management'

function setupChain(finalResult: { data: unknown; error: unknown }) {
  mockSingle.mockResolvedValue(finalResult)
  mockOrder.mockResolvedValue(finalResult)
  mockEq.mockReturnValue({ order: mockOrder, single: mockSingle })
  mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ insert: mockInsert, select: mockSelect, update: mockUpdate })
}

describe('api-key-management — pure token helpers', () => {
  describe('generateApiToken', () => {
    it('starts with the pype_ prefix', () => {
      expect(generateApiToken()).toMatch(/^pype_/)
    })

    it('contains 32 hex bytes after the prefix (64 hex chars)', () => {
      const token = generateApiToken()
      const hex = token.slice('pype_'.length)
      expect(hex).toMatch(/^[a-f0-9]{64}$/)
    })

    it('generates unique tokens on each call', () => {
      const t1 = generateApiToken()
      const t2 = generateApiToken()
      expect(t1).not.toBe(t2)
    })

    it('total length is 69 chars (5 prefix + 64 hex)', () => {
      expect(generateApiToken().length).toBe(69)
    })
  })

  describe('hashToken', () => {
    it('returns a 64-char lowercase hex SHA-256 hash', () => {
      const hash = hashToken('some-token')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('is deterministic for the same input', () => {
      expect(hashToken('same')).toBe(hashToken('same'))
    })

    it('produces different hashes for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'))
    })

    it('hashing a pype_ token produces consistent output', () => {
      const token = generateApiToken()
      const h1 = hashToken(token)
      const h2 = hashToken(token)
      expect(h1).toBe(h2)
    })
  })

  describe('maskToken', () => {
    it('shows first 8 and last 8 characters with ... in between', () => {
      const token = 'pype_abcdefghijklmnopqrstuvwxyz12345678'
      const masked = maskToken(token)
      expect(masked).toMatch(/^.{8}\.\.\..{8}$/)
      expect(masked.startsWith(token.slice(0, 8))).toBe(true)
      expect(masked.endsWith(token.slice(-8))).toBe(true)
    })

    it('returns the token unchanged when shorter than 16 chars', () => {
      const short = 'abc123'
      expect(maskToken(short)).toBe(short)
    })

    it('handles exactly 16 chars (boundary)', () => {
      const t = 'abcdefghijklmnop' // 16 chars
      const masked = maskToken(t)
      expect(masked).toMatch(/^.{8}\.\.\..{8}$/)
    })
  })
})

describe('api-key-management — DB functions (mocked supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createProjectApiKey', () => {
    it('returns success with id on successful insert', async () => {
      setupChain({ data: { id: 'key-uuid-001' }, error: null })
      const result = await createProjectApiKey('proj-1', 'user-clerk-1', generateApiToken())
      expect(result.success).toBe(true)
      expect(result.id).toBe('key-uuid-001')
    })

    it('returns failure when supabase returns an error', async () => {
      setupChain({ data: null, error: { message: 'duplicate key value' } })
      const result = await createProjectApiKey('proj-1', 'user-clerk-1', generateApiToken())
      expect(result.success).toBe(false)
      expect(result.error).toContain('duplicate')
    })

    it('calls from with the correct table name', async () => {
      setupChain({ data: { id: 'key-001' }, error: null })
      await createProjectApiKey('proj-1', 'user-clerk-1', generateApiToken())
      expect(mockFrom).toHaveBeenCalledWith('pype_voice_api_keys')
    })

    it('returns success false on unexpected thrown error', async () => {
      mockFrom.mockImplementationOnce(() => { throw new Error('network failure') })
      const result = await createProjectApiKey('proj-1', 'user-clerk-1', generateApiToken())
      expect(result.success).toBe(false)
      expect(result.error).toBe('network failure')
    })
  })

  describe('getProjectApiKeys', () => {
    it('returns success with data array on success', async () => {
      setupChain({ data: [{ id: 'key-1' }, { id: 'key-2' }], error: null })
      const result = await getProjectApiKeys('proj-1')
      expect(result.success).toBe(true)
      expect((result as any).data).toHaveLength(2)
    })

    it('returns empty array when data is null', async () => {
      setupChain({ data: null, error: null })
      const result = await getProjectApiKeys('proj-1')
      expect(result.success).toBe(true)
      expect((result as any).data).toHaveLength(0)
    })

    it('returns failure when supabase returns an error', async () => {
      setupChain({ data: null, error: { message: 'permission denied' } })
      const result = await getProjectApiKeys('proj-1')
      expect(result.success).toBe(false)
      expect(result.error).toContain('permission denied')
    })

    it('returns success false on unexpected thrown error', async () => {
      mockFrom.mockImplementationOnce(() => { throw new Error('db connection lost') })
      const result = await getProjectApiKeys('proj-1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('db connection lost')
    })
  })

  describe('updateKeyLastUsed', () => {
    it('does not throw when update succeeds', async () => {
      setupChain({ data: null, error: null })
      await expect(updateKeyLastUsed('somehash')).resolves.toBeUndefined()
    })

    it('does not throw when supabase throws (fire-and-forget)', async () => {
      mockFrom.mockImplementationOnce(() => { throw new Error('timeout') })
      await expect(updateKeyLastUsed('somehash')).resolves.toBeUndefined()
    })

    it('calls update on the correct table', async () => {
      setupChain({ data: null, error: null })
      await updateKeyLastUsed('test-hash')
      expect(mockFrom).toHaveBeenCalledWith('pype_voice_api_keys')
      expect(mockUpdate).toHaveBeenCalled()
    })
  })
})
