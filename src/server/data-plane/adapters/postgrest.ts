/**
 * Customer destination: plain PostgREST behind the customer's HTTPS front end.
 * The Supabase client always calls /rest/v1, so this builds a PostgrestClient on
 * the customer base URL. Calls time out after 8 s; the token lives 5 minutes.
 */
import { createSign } from 'node:crypto'
import { PostgrestClient } from '@supabase/postgrest-js'
import { DestinationIncompatible, DestinationUnavailable } from '../errors'
import type { DataPlane } from '../ports'
import { createQueryPlane, type Db } from './queryPlane'

export const CALL_TIMEOUT_MS = 8000
const TOKEN_TTL_S = 300

export interface PostgrestDestination {
  id: string
  name: string
  /** Non-secret registry config. */
  config: { base_url?: string; audience?: string; role?: string }
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url')

/** RS256 token for one customer: audience per customer, role pype_writer unless config says otherwise. */
export function mintToken(dest: PostgrestDestination, privateKeyPem: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify({
    aud: dest.config.audience ?? dest.name,
    role: dest.config.role ?? 'pype_writer',
    iat,
    exp: iat + TOKEN_TTL_S,
  }))
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKeyPem)
  return `${head}.${body}.${b64url(sig)}`
}

function baseUrl(dest: PostgrestDestination): string {
  const url = dest.config.base_url
  // http is allowed for localhost only (the docker stand-in); the customer front end is https.
  if (!url || !/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)) {
    throw new DestinationIncompatible(dest.name, 'Destination has no valid base_url')
  }
  return url.replace(/\/+$/, '')
}

/** `privateKeyPem` is the already-resolved secret; it is never stored on the plane or logged. */
export function createPostgrestPlane(dest: PostgrestDestination, privateKeyPem: string): DataPlane {
  const base = baseUrl(dest)
  const authedFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${mintToken(dest, privateKeyPem)}`)
    return fetch(input, { ...init, headers, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) })
  }
  const db = new PostgrestClient(base, { fetch: authedFetch }) as unknown as Db
  return {
    ...createQueryPlane(db, { typed: true, destination: dest.name }),
    storage: {
      async signRecordingUrl(key, ttlSeconds) {
        let res: Response
        try {
          res = await authedFetch(`${base}/signer/v1/recordings/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, ttl_seconds: ttlSeconds }),
          })
        } catch {
          throw new DestinationUnavailable(dest.name)
        }
        if (!res.ok) throw new DestinationUnavailable(dest.name)
        return ((await res.json()) as { url: string }).url
      },
    },
  }
}
