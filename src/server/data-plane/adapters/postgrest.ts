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
import { mtlsFetch, type ClientCert } from './mtlsFetch'

export const CALL_TIMEOUT_MS = 8000
const TOKEN_TTL_S = 300
/** The customer signer only signs read links that live 5 to 15 minutes; anything else is a 400. */
const SIGNER_MIN_TTL_S = 300
const SIGNER_MAX_TTL_S = 900

export interface PostgrestDestination {
  id: string
  name: string
  /** Non-secret registry config. */
  config: { base_url?: string; audience?: string; role?: string; kid?: string; storage?: string; /** the front end requires Pype's TLS client certificate */ mtls?: boolean; /** free-text note on how the customer's network admits Pype (IP allow-list, mTLS, both) */ ingress?: string }
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url')

/** RS256 token for one customer: audience per customer, role pype_writer unless config says otherwise. */
export function mintToken(dest: PostgrestDestination, privateKeyPem: string, now = Date.now(), extra: Record<string, string> = {}): string {
  const iat = Math.floor(now / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', ...(dest.config.kid && { kid: dest.config.kid }) }))
  const body = b64url(JSON.stringify({
    aud: dest.config.audience ?? dest.name,
    role: dest.config.role ?? 'pype_writer',
    iat,
    exp: iat + TOKEN_TTL_S,
    ...extra,
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
  let href = url.href
  while (href.endsWith('/')) href = href.slice(0, -1)
  return href
}

/** `privateKeyPem` is the already-resolved secret; it is never stored on the plane or logged. */
export function createPostgrestPlane(dest: PostgrestDestination, privateKeyPem: string, clientCert?: ClientCert): DataPlane {
  const base = baseUrl(dest)
  // mtls: true without a certificate is an error, never a plain connection
  if (dest.config.mtls && !clientCert) throw new DestinationIncompatible(dest.name, 'Destination requires a client certificate')
  const send: typeof fetch = clientCert ? mtlsFetch(clientCert) : fetch
  const authedFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${mintToken(dest, privateKeyPem)}`)
    return send(input, { ...init, headers, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) })
  }
  const db = new PostgrestClient(base, { fetch: authedFetch }) as unknown as Db
  return {
    ...createQueryPlane(db, { typed: true, destination: dest.name }),
    storage: {
      async signRecordingUrl(key, ttlSeconds) {
        let res: Response
        try {
          // The signer only signs keys `recordings/<project_id>/...` for a token carrying that project_id.
          const token = mintToken(dest, privateKeyPem, Date.now(), { project_id: key.split('/')[1] ?? '' })
          res = await send(`${base}/signer/v1/recordings/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ key, expires_in: Math.min(Math.max(Math.round(ttlSeconds), SIGNER_MIN_TTL_S), SIGNER_MAX_TTL_S) }),
            signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
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
 * The attach checklist: connect, schema version, database schema_info (the signer's health check covers storage).
 * Uses the signer's `/signer/v1/health` and `/signer/v1/version` and the schema pack's `rpc/schema_info`. Details never include secrets.
 */
export async function verifyPostgrestDestination(dest: PostgrestDestination, privateKeyPem: string, expectedSchemaVersion: number, clientCert?: ClientCert): Promise<VerifyCheck[]> {
  const base = baseUrl(dest)
  if (dest.config.mtls && !clientCert) return [{ name: 'client certificate', ok: false, detail: 'config.mtls is set but the secret has no client_cert / client_key' }]
  const send: typeof fetch = clientCert ? mtlsFetch(clientCert) : fetch
  const call = async (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${mintToken(dest, privateKeyPem)}`)
    return send(`${base}${path}`, { ...init, headers, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) })
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

  return [
    // storage 'none' (test only): the signer's Azure Blob adapter is not implemented yet, so its health check cannot pass.
    await run('connect', async () => { need(await call(dest.config.storage === 'none' ? '/' : '/signer/v1/health'), 'health') }),
    await run('schema version', async () => {
      const { schema } = (await need(await call('/signer/v1/version'), 'version').json()) as { schema: number }
      if (schema !== expectedSchemaVersion) throw new Error(`schema version ${schema}, expected ${expectedSchemaVersion}`)
      return `v${schema}`
    }),
    await run('database', async () => {
      const { schema_version } = (await need(await call('/rpc/schema_info', { method: 'POST', headers: jsonHeaders, body: '{}' }), 'schema_info').json()) as { schema_version: number }
      if (schema_version !== expectedSchemaVersion) throw new Error(`database schema ${schema_version}, expected ${expectedSchemaVersion}`)
    }),
  ]
}
