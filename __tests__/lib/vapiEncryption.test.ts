import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSingle, mockEq, mockSelect, mockFrom } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

import {
  generateProjectEncryptionKey,
  encryptApiKey,
  decryptApiKey,
  isEncrypted,
  safeEncryptApiKey,
  safeDecryptApiKey,
  getDecryptedVapiKeys,
} from '@/lib/vapi-encryption'

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: null, error: null })
  mockEq.mockReturnValue({ single: mockSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
})

const PROJECT_ID = 'proj-test-abc-123'

describe('vapi-encryption', () => {
  describe('generateProjectEncryptionKey', () => {
    it('returns a 32-byte Buffer', () => {
      const key = generateProjectEncryptionKey(PROJECT_ID)
      expect(Buffer.isBuffer(key)).toBe(true)
      expect(key.length).toBe(32)
    })

    it('produces the same key for the same projectId (deterministic)', () => {
      const k1 = generateProjectEncryptionKey(PROJECT_ID)
      const k2 = generateProjectEncryptionKey(PROJECT_ID)
      expect(k1.toString('hex')).toBe(k2.toString('hex'))
    })

    it('produces different keys for different projectIds', () => {
      const k1 = generateProjectEncryptionKey('project-a')
      const k2 = generateProjectEncryptionKey('project-b')
      expect(k1.toString('hex')).not.toBe(k2.toString('hex'))
    })
  })

  describe('encryptApiKey & decryptApiKey', () => {
    it('round-trips a plain API key', () => {
      const apiKey = 'sk-abc123def456'
      const enc = encryptApiKey(apiKey, PROJECT_ID)
      expect(decryptApiKey(enc, PROJECT_ID)).toBe(apiKey)
    })

    it('round-trips an empty string', () => {
      expect(decryptApiKey(encryptApiKey('', PROJECT_ID), PROJECT_ID)).toBe('')
    })

    it('produces different ciphertext each call (random IV)', () => {
      const enc1 = encryptApiKey('key', PROJECT_ID)
      const enc2 = encryptApiKey('key', PROJECT_ID)
      expect(enc1).not.toBe(enc2)
    })

    it('output matches iv:authTag:data format', () => {
      const enc = encryptApiKey('test-key', PROJECT_ID)
      const parts = enc.split(':')
      expect(parts).toHaveLength(3)
      parts.forEach(p => expect(p).toMatch(/^[a-f0-9]+$/i))
    })

    it('throws when decrypting with a different projectId', () => {
      const enc = encryptApiKey('secret', PROJECT_ID)
      expect(() => decryptApiKey(enc, 'different-project')).toThrow()
    })

    it('throws on malformed encrypted data', () => {
      expect(() => decryptApiKey('bad:format', PROJECT_ID)).toThrow()
    })
  })

  describe('isEncrypted', () => {
    it('returns true for a properly encrypted value', () => {
      expect(isEncrypted(encryptApiKey('test', PROJECT_ID))).toBe(true)
    })

    it('returns false for a plain API key', () => {
      expect(isEncrypted('sk-plainapikey123')).toBe(false)
    })

    it('returns true for three hex segments', () => {
      expect(isEncrypted('aabbcc:ddeeff:001122')).toBe(true)
    })

    it('returns false for two segments', () => {
      expect(isEncrypted('aabb:ccdd')).toBe(false)
    })
  })

  describe('safeEncryptApiKey', () => {
    it('encrypts a plain key', () => {
      const enc = safeEncryptApiKey('plain-key', PROJECT_ID)
      expect(isEncrypted(enc)).toBe(true)
    })

    it('returns already-encrypted value unchanged', () => {
      const enc = encryptApiKey('secret', PROJECT_ID)
      expect(safeEncryptApiKey(enc, PROJECT_ID)).toBe(enc)
    })
  })

  describe('safeDecryptApiKey', () => {
    it('decrypts an encrypted key', () => {
      const enc = encryptApiKey('my-key', PROJECT_ID)
      expect(safeDecryptApiKey(enc, PROJECT_ID)).toBe('my-key')
    })

    it('returns plain text unchanged when not encrypted format', () => {
      expect(safeDecryptApiKey('plain-key', PROJECT_ID)).toBe('plain-key')
    })
  })

  describe('getDecryptedVapiKeys', () => {
    const AGENT_ID = 'agent-001'

    it('returns decrypted apiKey and projectApiKey on success', async () => {
      const projectId = 'proj-xyz'
      const rawApiKey = 'vapi-sk-real-api-key'
      const rawProjectKey = 'vapi-pk-real-project-key'
      const encApiKey = encryptApiKey(rawApiKey, projectId)
      const encProjectKey = encryptApiKey(rawProjectKey, projectId)

      mockSingle.mockResolvedValue({
        data: {
          vapi_api_key_encrypted: encApiKey,
          vapi_project_key_encrypted: encProjectKey,
          project_id: projectId,
        },
        error: null,
      })

      const result = await getDecryptedVapiKeys(AGENT_ID)
      expect(result.apiKey).toBe(rawApiKey)
      expect(result.projectApiKey).toBe(rawProjectKey)
    })

    it('throws "Agent not found" when supabase returns an error', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'row not found' } })
      await expect(getDecryptedVapiKeys(AGENT_ID)).rejects.toThrow('Agent not found')
    })

    it('throws "Agent not found" when agent data is null', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null })
      await expect(getDecryptedVapiKeys(AGENT_ID)).rejects.toThrow('Agent not found')
    })

    it('throws "Vapi keys not found" when vapi_api_key_encrypted is missing', async () => {
      mockSingle.mockResolvedValue({
        data: { vapi_api_key_encrypted: null, vapi_project_key_encrypted: 'aabb:ccdd:eeff', project_id: 'p1' },
        error: null,
      })
      await expect(getDecryptedVapiKeys(AGENT_ID)).rejects.toThrow('Vapi keys not found')
    })

    it('throws "Vapi keys not found" when vapi_project_key_encrypted is missing', async () => {
      mockSingle.mockResolvedValue({
        data: { vapi_api_key_encrypted: 'aabb:ccdd:eeff', vapi_project_key_encrypted: null, project_id: 'p1' },
        error: null,
      })
      await expect(getDecryptedVapiKeys(AGENT_ID)).rejects.toThrow('Vapi keys not found')
    })

    it('throws "Decryption failed" when encrypted data is corrupted', async () => {
      mockSingle.mockResolvedValue({
        data: {
          vapi_api_key_encrypted: 'deadbeef:cafebabe:00112233',
          vapi_project_key_encrypted: 'deadbeef:cafebabe:00112233',
          project_id: 'proj-different',
        },
        error: null,
      })
      await expect(getDecryptedVapiKeys(AGENT_ID)).rejects.toThrow('Decryption failed')
    })

    it('queries the pype_voice_agents table with the given agentId', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
      await expect(getDecryptedVapiKeys('agent-xyz')).rejects.toThrow()
      expect(mockFrom).toHaveBeenCalledWith('pype_voice_agents')
      expect(mockEq).toHaveBeenCalledWith('id', 'agent-xyz')
    })
  })
})
