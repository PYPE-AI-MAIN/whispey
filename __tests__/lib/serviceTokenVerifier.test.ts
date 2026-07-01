import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { hasValidServiceToken } from '@/lib/serviceTokenVerifier'

// ── Constants ────────────────────────────────────────────────────────────────

const SECRET = 'test-pype-jwt-secret-for-unit-tests'
const WRONG_SECRET = 'completely-different-secret'
const AUD = 'pype-vc-bots'
const SUB = 'pype-analytics-dashboard'
const NOW = () => Math.floor(Date.now() / 1000)

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Mint a valid HS256 token using the test secret. */
function mintValid(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    { sub: SUB, iss: SUB, aud: AUD, ...overrides },
    SECRET,
    { algorithm: 'HS256', expiresIn: '5m' },
  )
}

/**
 * Build a raw JWT without using jsonwebtoken so we can craft invalid tokens
 * (alg:none, arbitrary headers, missing claims, etc.).
 */
function craftToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  signature = '',
): string {
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${enc(header)}.${enc(payload)}.${signature}`
}

function bearer(token: string) {
  return `Bearer ${token}`
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('hasValidServiceToken', () => {
  beforeEach(() => vi.stubEnv('PYPE_JWT_SECRET', SECRET))
  afterEach(() => vi.unstubAllEnvs())

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('valid token', () => {
    it('accepts a correctly signed, unexpired token', async () => {
      expect(await hasValidServiceToken(bearer(mintValid()))).toBe(true)
    })

    it('accepts a token whose aud claim is an array containing the expected audience', async () => {
      const token = jwt.sign(
        { sub: SUB, aud: [AUD, 'other-service'], exp: NOW() + 300 },
        SECRET,
        { algorithm: 'HS256' },
      )
      expect(await hasValidServiceToken(bearer(token))).toBe(true)
    })
  })

  // ── Header format ──────────────────────────────────────────────────────────

  describe('Authorization header format', () => {
    it('rejects null header', async () => {
      expect(await hasValidServiceToken(null)).toBe(false)
    })

    it('rejects empty string', async () => {
      expect(await hasValidServiceToken('')).toBe(false)
    })

    it('rejects header without Bearer prefix', async () => {
      expect(await hasValidServiceToken(mintValid())).toBe(false)
    })

    it('rejects Basic auth header', async () => {
      expect(await hasValidServiceToken('Basic dXNlcjpwYXNz')).toBe(false)
    })

    it('rejects "Bearer" with no token after it', async () => {
      expect(await hasValidServiceToken('Bearer ')).toBe(false)
    })
  })

  // ── Token structure ────────────────────────────────────────────────────────

  describe('token structure', () => {
    it('rejects token with only two segments', async () => {
      expect(await hasValidServiceToken('Bearer header.payload')).toBe(false)
    })

    it('rejects token with four segments', async () => {
      expect(await hasValidServiceToken(`Bearer ${mintValid()}.extra`)).toBe(false)
    })

    it('rejects completely random string', async () => {
      expect(await hasValidServiceToken('Bearer thisisnotavalidtoken')).toBe(false)
    })

    it('rejects token with invalid base64url in signature', async () => {
      const parts = mintValid().split('.')
      expect(await hasValidServiceToken(`Bearer ${parts[0]}.${parts[1]}.!@#$%`)).toBe(false)
    })

    it('rejects token with invalid base64url in payload', async () => {
      const parts = mintValid().split('.')
      expect(await hasValidServiceToken(`Bearer ${parts[0]}.!!!invalid!!!.${parts[2]}`)).toBe(false)
    })
  })

  // ── Algorithm check ────────────────────────────────────────────────────────

  describe('algorithm validation', () => {
    it('rejects alg:none (algorithm confusion attack)', async () => {
      const token = craftToken(
        { alg: 'none', typ: 'JWT' },
        { sub: SUB, aud: AUD, exp: NOW() + 300 },
        '', // no signature
      )
      expect(await hasValidServiceToken(bearer(token))).toBe(false)
    })

    it('rejects RS256 header even if payload is otherwise valid', async () => {
      const token = craftToken(
        { alg: 'RS256', typ: 'JWT' },
        { sub: SUB, aud: AUD, exp: NOW() + 300 },
        'fakesig',
      )
      expect(await hasValidServiceToken(bearer(token))).toBe(false)
    })
  })

  // ── Signature verification ─────────────────────────────────────────────────

  describe('signature verification', () => {
    it('rejects token signed with a different secret', async () => {
      const token = jwt.sign(
        { sub: SUB, aud: AUD, exp: NOW() + 300 },
        WRONG_SECRET,
        { algorithm: 'HS256' },
      )
      expect(await hasValidServiceToken(bearer(token))).toBe(false)
    })

    it('rejects token with a tampered payload (signature mismatch)', async () => {
      const parts = mintValid().split('.')
      // Replace payload segment with a crafted one while keeping original signature
      const tamperedPayload = btoa(JSON.stringify({ sub: 'attacker', aud: AUD, exp: NOW() + 300 }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
      expect(await hasValidServiceToken(`Bearer ${parts[0]}.${tamperedPayload}.${parts[2]}`)).toBe(false)
    })

    it('rejects token with a tampered header', async () => {
      const parts = mintValid().split('.')
      const tamperedHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT', extra: 'injected' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
      expect(await hasValidServiceToken(`Bearer ${tamperedHeader}.${parts[1]}.${parts[2]}`)).toBe(false)
    })
  })

  // ── Claims validation ──────────────────────────────────────────────────────

  describe('claims validation', () => {
    it('rejects an expired token', async () => {
      const token = jwt.sign(
        { sub: SUB, aud: AUD, exp: NOW() - 60 },
        SECRET,
        { algorithm: 'HS256' },
      )
      expect(await hasValidServiceToken(bearer(token))).toBe(false)
    })

    it('rejects a token expiring at exactly the current second', async () => {
      const token = jwt.sign(
        { sub: SUB, aud: AUD, exp: NOW() },
        SECRET,
        { algorithm: 'HS256' },
      )
      expect(await hasValidServiceToken(bearer(token))).toBe(false)
    })

    it('rejects token without an exp claim', async () => {
      // jwt.sign without expiresIn produces no exp claim
      const token = jwt.sign({ sub: SUB, aud: AUD }, SECRET, { algorithm: 'HS256' })
      expect(await hasValidServiceToken(bearer(token))).toBe(false)
    })

    it('rejects token with wrong audience', async () => {
      const token = jwt.sign(
        { sub: SUB, aud: 'wrong-audience', exp: NOW() + 300 },
        SECRET,
        { algorithm: 'HS256' },
      )
      expect(await hasValidServiceToken(bearer(token))).toBe(false)
    })

    it('rejects token with empty audience array', async () => {
      const token = jwt.sign(
        { sub: SUB, aud: [], exp: NOW() + 300 },
        SECRET,
        { algorithm: 'HS256' },
      )
      expect(await hasValidServiceToken(bearer(token))).toBe(false)
    })

    it('rejects token with audience array that does not include expected value', async () => {
      const token = jwt.sign(
        { sub: SUB, aud: ['other-service'], exp: NOW() + 300 },
        SECRET,
        { algorithm: 'HS256' },
      )
      expect(await hasValidServiceToken(bearer(token))).toBe(false)
    })
  })

  // ── Environment ────────────────────────────────────────────────────────────

  describe('environment', () => {
    it('rejects when PYPE_JWT_SECRET is not set', async () => {
      vi.stubEnv('PYPE_JWT_SECRET', '')
      expect(await hasValidServiceToken(bearer(mintValid()))).toBe(false)
    })
  })
})
