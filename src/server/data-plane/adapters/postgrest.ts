/**
 * Customer destination: plain PostgREST behind the customer's HTTPS front end.
 * The Supabase client always calls /rest/v1, so this builds a PostgrestClient on
 * the customer base URL. Calls time out after 8 s; the token lives 5 minutes.
 */
import { createSign, randomUUID } from 'node:crypto'
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
  let url: URL | null = null
  try {
    url = new URL(dest.config.base_url ?? '')
  } catch {
    // falls through to the error below
  }
  // http is allowed for localhost only (the docker stand-in); the customer front end is https.
  const local = url?.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (!url || (url.protocol !== 'https:' && !local)) {
    throw new DestinationIncompatible(dest.name, 'Destination has no valid base_url')
  }
  return url.href.replace(/\/+$/, '')
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

export interface VerifyCheck { name: string; ok: boolean; detail?: string }

/**
 * The attach checklist: connect, schema version, write/read/delete probe, storage sign.
 * Assumes the schema pack's `pype_probe(id, note)` table and the signer's
 * `/signer/v1/health` and `/signer/v1/version` (design page 2, section 5). Details never include secrets.
 */
export async function verifyPostgrestDestination(dest: PostgrestDestination, privateKeyPem: string, expectedSchemaVersion: number): Promise<VerifyCheck[]> {
  const base = baseUrl(dest)
  const call = async (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${mintToken(dest, privateKeyPem)}`)
    return fetch(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) })
  }
  const run = async (name: string, fn: () => Promise<string | void>): Promise<VerifyCheck> => {
    try {
      return { name, ok: true, detail: (await fn()) || undefined }
    } catch (e) {
      return { name, ok: false, detail: e instanceof Error ? e.message : 'failed' }
    }
  }
  const need = (res: Response, what: string) => {
    if (!res.ok) throw new Error(`${what} returned HTTP ${res.status}`)
    return res
  }
  const jsonHeaders = { 'Content-Type': 'application/json', Prefer: 'return=representation' }
  const probeId = randomUUID()

  return [
    await run('connect', async () => { need(await call('/signer/v1/health'), 'health') }),
    await run('schema version', async () => {
      const { version } = (await need(await call('/signer/v1/version'), 'version').json()) as { version: number }
      if (version !== expectedSchemaVersion) throw new Error(`schema version ${version}, expected ${expectedSchemaVersion}`)
      return `v${version}`
    }),
    await run('write probe', async () => { need(await call('/pype_probe', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ id: probeId, note: 'verify' }) }), 'write') }),
    await run('read probe', async () => {
      const rows = (await need(await call(`/pype_probe?id=eq.${probeId}&select=id`), 'read').json()) as unknown[]
      if (rows.length !== 1) throw new Error('probe row not found')
    }),
    await run('delete probe', async () => { need(await call(`/pype_probe?id=eq.${probeId}`, { method: 'DELETE' }), 'delete') }),
    await run('storage sign', async () => {
      const res = need(await call('/signer/v1/recordings/sign', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ key: `probe/${probeId}`, ttl_seconds: 60 }) }), 'sign')
      if (!((await res.json()) as { url?: string }).url) throw new Error('no signed url returned')
    }),
  ]
}
