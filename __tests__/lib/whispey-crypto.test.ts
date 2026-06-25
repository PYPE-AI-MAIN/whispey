import { describe, it, expect } from 'vitest'
import { encryptWithWhispeyKey, decryptWithWhispeyKey } from '@/lib/whispey-crypto'

describe('whispey-crypto — AES-256-GCM with WHISPEY_MASTER_KEY', () => {
  describe('encryptWithWhispeyKey & decryptWithWhispeyKey', () => {
    it('round-trips a plain string', () => {
      const plain = 'whispey-secret-token'
      expect(decryptWithWhispeyKey(encryptWithWhispeyKey(plain))).toBe(plain)
    })

    it('round-trips an empty string', () => {
      expect(decryptWithWhispeyKey(encryptWithWhispeyKey(''))).toBe('')
    })

    it('round-trips a unicode string', () => {
      const text = 'Bearer eyJhbGciOiJSUzI1NiJ9.test — 🔑'
      expect(decryptWithWhispeyKey(encryptWithWhispeyKey(text))).toBe(text)
    })

    it('produces different ciphertext per call (random IV)', () => {
      const plain = 'repeat'
      expect(encryptWithWhispeyKey(plain)).not.toBe(encryptWithWhispeyKey(plain))
    })

    it('output has format iv:authTag:data (3 hex segments)', () => {
      const enc = encryptWithWhispeyKey('data')
      const parts = enc.split(':')
      expect(parts).toHaveLength(3)
      parts.forEach(p => expect(p).toMatch(/^[a-f0-9]+$/i))
    })

    it('throws on corrupted ciphertext', () => {
      const enc = encryptWithWhispeyKey('value')
      const bad = enc.replace(/.$/, 'x')
      expect(() => decryptWithWhispeyKey(bad)).toThrow()
    })

    it('throws when format has fewer than 3 segments', () => {
      // Inner error is wrapped by the catch block
      expect(() => decryptWithWhispeyKey('only:two')).toThrow('Failed to decrypt data')
    })
  })
})
