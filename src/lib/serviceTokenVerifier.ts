/**
 * Edge-compatible JWT verifier for internal service-to-server calls.
 *
 * Uses the Web Crypto API (crypto.subtle) — no Node.js-only modules — so it
 * runs safely in both the Next.js Edge runtime (middleware) and Node.js.
 *
 * Only accepts HS256 tokens signed with PYPE_JWT_SECRET that carry the
 * expected audience claim and have not expired. Algorithm and audience checks
 * prevent known JWT confusion attacks (alg:none, wrong-audience spoofing).
 */

const EXPECTED_ALG = 'HS256'
const EXPECTED_AUD = 'pype-vc-bots'

/**
 * Convert a base64url string to an ArrayBuffer.
 * Uses codePointAt (preferred over charCodeAt for Unicode correctness).
 * Throws on invalid base64url input.
 */
function base64UrlToBuffer(input: string): ArrayBuffer {
  const base64 = input.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i) ?? 0
  }
  return bytes.buffer
}

/** Decode a base64url JWT segment into a plain object. Throws on invalid JSON. */
function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBuffer(segment)))
}

/**
 * Returns true when the Authorization header carries a valid Bearer JWT that:
 *  1. Is structurally well-formed (3 dot-separated segments)
 *  2. Declares alg: HS256 in its header (prevents alg:none attacks)
 *  3. Has a valid HMAC-SHA256 signature verified against PYPE_JWT_SECRET
 *  4. Carries the expected audience claim (pype-vc-bots)
 *  5. Has an explicit exp claim that has not passed
 *
 * Returns false for any failure — malformed token, wrong secret, expired,
 * missing env var — without throwing.
 */
export async function hasValidServiceToken(authHeader: string | null): Promise<boolean> {
  // TEMP DEBUG — remove once the restore/webhook auth investigation is closed.
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[serviceTokenVerifier] fail: no Bearer prefix', { authHeader })
    return false
  }

  const token = authHeader.slice(7).trim()
  const parts = token.split('.')
  if (parts.length !== 3) {
    console.log('[serviceTokenVerifier] fail: wrong part count', { partCount: parts.length })
    return false
  }

  const secret = process.env.PYPE_JWT_SECRET
  if (!secret) {
    console.log('[serviceTokenVerifier] fail: no secret')
    return false
  }

  try {
    // 1. Check algorithm claim before any crypto work (alg confusion guard)
    const header = decodeSegment(parts[0])
    if (header.alg !== EXPECTED_ALG) {
      console.log('[serviceTokenVerifier] fail: alg mismatch', { alg: header.alg })
      return false
    }

    // 2. Import the HMAC key for verification only (not extractable)
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    // 3. Verify HMAC signature over the signed input (header.payload)
    const sigInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`).buffer
    const sigBytes = base64UrlToBuffer(parts[2])
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, sigInput)
    if (!valid) {
      console.log('[serviceTokenVerifier] fail: signature invalid', {
        secretLen: secret.length,
        tokenPreview: token.slice(0, 20) + '...',
      })
      return false
    }

    // 4. Decode payload and validate claims (only after signature is verified)
    const payload = decodeSegment(parts[1])

    // Audience: accept both string and array forms
    const aud = payload.aud
    const audValid =
      aud === EXPECTED_AUD ||
      (Array.isArray(aud) && aud.includes(EXPECTED_AUD))
    if (!audValid) {
      console.log('[serviceTokenVerifier] fail: aud mismatch', { aud })
      return false
    }

    // Expiry: must be present and in the future (no exp = reject)
    const exp = payload.exp
    if (typeof exp !== 'number') {
      console.log('[serviceTokenVerifier] fail: exp not a number', { exp })
      return false
    }
    if (exp <= Math.floor(Date.now() / 1000)) {
      console.log('[serviceTokenVerifier] fail: token expired', { exp, now: Math.floor(Date.now() / 1000) })
      return false
    }

    console.log('[serviceTokenVerifier] SUCCESS')
    return true
  } catch (err) {
    // Covers: malformed base64url, invalid JSON, crypto errors
    console.log('[serviceTokenVerifier] fail: exception', { message: (err as Error)?.message })
    return false
  }
}
