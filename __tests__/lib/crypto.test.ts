import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, isEncrypted, safeEncrypt, safeDecrypt } from '@/lib/crypto'

describe('crypto — AES-256-GCM encrypt/decrypt', () => {
  describe('encrypt & decrypt', () => {
    it('round-trips a plain string', () => {
      const plain = 'my-secret-api-key-12345'
      expect(decrypt(encrypt(plain))).toBe(plain)
    })

    it('round-trips an empty string', () => {
      expect(decrypt(encrypt(''))).toBe('')
    })

    it('round-trips a string with special characters', () => {
      const text = 'Hello! @World# $%^&*() — ñ 中文 🔐'
      expect(decrypt(encrypt(text))).toBe(text)
    })

    it('produces different ciphertext for the same input (random IV)', () => {
      const plain = 'same-input'
      expect(encrypt(plain)).not.toBe(encrypt(plain))
    })

    it('returns a colon-separated hex string (iv:authTag:data)', () => {
      const result = encrypt('test')
      const parts = result.split(':')
      expect(parts).toHaveLength(3)
      parts.forEach(p => expect(p).toMatch(/^[a-f0-9]+$/i))
    })

    it('throws on tampered ciphertext', () => {
      const enc = encrypt('secret')
      const tampered = enc.slice(0, -4) + 'dead'
      expect(() => decrypt(tampered)).toThrow()
    })

    it('throws when format is wrong (missing colons)', () => {
      // Inner error is wrapped by the catch block
      expect(() => decrypt('notvalidhex')).toThrow('Failed to decrypt data')
    })
  })

  describe('isEncrypted', () => {
    it('returns true for a properly encrypted value', () => {
      expect(isEncrypted(encrypt('hello'))).toBe(true)
    })

    it('returns false for plain text', () => {
      expect(isEncrypted('plain-text')).toBe(false)
    })

    it('returns false for partial hex with wrong segments', () => {
      expect(isEncrypted('abc:def')).toBe(false)
    })

    it('returns true for three hex segments', () => {
      expect(isEncrypted('aabbcc:ddeeff:112233')).toBe(true)
    })

    it('returns false when a segment contains non-hex chars', () => {
      expect(isEncrypted('aabbcc:ddZZff:112233')).toBe(false)
    })
  })

  describe('safeEncrypt', () => {
    it('encrypts plain text', () => {
      const enc = safeEncrypt('plain')
      expect(isEncrypted(enc)).toBe(true)
    })

    it('returns already-encrypted value unchanged', () => {
      const enc = encrypt('hello')
      expect(safeEncrypt(enc)).toBe(enc)
    })
  })

  describe('safeDecrypt', () => {
    it('decrypts an encrypted value', () => {
      expect(safeDecrypt(encrypt('world'))).toBe('world')
    })

    it('returns plain text unchanged', () => {
      expect(safeDecrypt('plain-text')).toBe('plain-text')
    })
  })
})
