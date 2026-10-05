/**
 * Pi's spam/fraud lookup: GET {SCAM_CHECK_URL}/api/v1/check?number=… on the internal Scam Checker
 * service (host: pype-internal-services EC2, spec at /openapi.json). Its bearer is a short-lived JWT, so the
 * preferred setup is SCAM_CHECK_CLIENT_ID + SCAM_CHECK_CLIENT_SECRET: a token is fetched from POST /auth/token,
 * cached until it expires, and refreshed on a 401. A fixed SCAM_CHECK_TOKEN still works but cannot refresh.
 * Only a fixed set of typed fields is passed back to the model — the service's free text is not trusted as
 * instructions — and the number is URL-encoded digits (with a leading + if given) so it cannot alter the URL.
 */
const DEFAULT_URL = 'https://scam-check.pypeai.com'
const ATTEMPT_TIMEOUT_MS = 6_000
const MAX_RETRIES = 2
const BASE_DELAY_MS = 300
const MAX_RETRY_AFTER_MS = 2_000
// a GET is safe to repeat; only transient failures are retried — a 4xx (bad token, bad number) never is
const RETRYABLE_STATUS = new Set([429, 502, 503, 504])

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Exponential backoff with jitter; a Retry-After the service sends wins, capped so the chat never stalls. */
function retryDelay(attempt: number, retryAfter: string | null) {
  const seconds = Number(retryAfter)
  if (retryAfter && Number.isFinite(seconds)) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
  return BASE_DELAY_MS * 2 ** attempt + Math.random() * BASE_DELAY_MS
}

/** `transient` marks an outage (unreachable, 429/5xx) as opposed to a bad request or token — only outages trip the circuit breaker. */
type SpamResult = { success: boolean; result: Record<string, unknown>; transient?: boolean }

/** Digits of a string or number; anything else (object, array, null) has none, instead of stringifying to "[object Object]". */
const digitsOf = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).replaceAll(/\D/g, '') : '')

/** The service reads "+917988307935" as international and "7988307935" as local, so a leading + the user typed must survive. */
const withPlus = (raw: unknown, digits: string) => (typeof raw === 'string' && raw.trim().startsWith('+') ? `+${digits}` : digits)

type Env = Record<string, string | undefined>
const tokenCache = new Map<string, { token: string; expiresAt: number }>()
export const resetSpamTokenCache = () => tokenCache.clear()

/** A bearer for the service, or null when neither client credentials nor a fixed token are configured. */
async function bearerFor(base: string, env: Env, fetchImpl: typeof fetch, force: boolean): Promise<{ token: string; refreshable: boolean } | { error: string } | null> {
  const id = env.SCAM_CHECK_CLIENT_ID?.trim()
  const secret = env.SCAM_CHECK_CLIENT_SECRET?.trim()
  if (!id || !secret) {
    const fixed = env.SCAM_CHECK_TOKEN?.trim()
    return fixed ? { token: fixed, refreshable: false } : null
  }
  const key = `${base}|${id}`
  const cached = tokenCache.get(key)
  if (!force && cached && cached.expiresAt > Date.now()) return { token: cached.token, refreshable: true }
  try {
    const res = await fetchImpl(`${base}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: id, client_secret: secret }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    })
    if (res.status === 401 || res.status === 403) return { error: 'The spam checker rejected its client credentials' }
    const data: any = res.ok ? await res.json().catch(() => null) : null
    if (typeof data?.access_token !== 'string') return { error: 'Could not get a token from the spam checker' }
    const ttlMs = Math.max(Number(data.expires_in) || 0, 0) * 1000
    // refresh a minute early so a token never expires mid-request; a very short ttl is simply not cached
    tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + ttlMs - 60_000 })
    return { token: data.access_token, refreshable: true }
  } catch {
    return { error: 'Could not reach the spam checker service' }
  }
}

/** One GET with retry + backoff on transient failures; null when the service could not be reached at all. */
async function getWithRetry(url: string, token: string, fetchImpl: typeof fetch, wait: (ms: number) => Promise<void>): Promise<Response | null> {
  let resp: Response | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      resp = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) })
      if (!RETRYABLE_STATUS.has(resp.status) || attempt === MAX_RETRIES) break
      await wait(retryDelay(attempt, resp.headers.get('retry-after')))
    } catch {
      resp = null
      if (attempt === MAX_RETRIES) break
      await wait(retryDelay(attempt, null))
    }
  }
  return resp
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : null)

export async function checkSpamNumber(
  number: unknown,
  fetchImpl: typeof fetch = fetch,
  env: Env = process.env,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<SpamResult> {
  const digits = digitsOf(number)
  if (digits.length < 7 || digits.length > 15) {
    return { success: false, result: { error: 'Give a phone number with 7–15 digits, e.g. 7988307935 or +919876543210' } }
  }
  const base = (env.SCAM_CHECK_URL?.trim() || DEFAULT_URL).replace(/\/$/, '')
  const bearer = await bearerFor(base, env, fetchImpl, false)
  if (!bearer) return { success: false, result: { error: 'The spam checker is not configured (set SCAM_CHECK_CLIENT_ID and SCAM_CHECK_CLIENT_SECRET, or SCAM_CHECK_TOKEN, on the server)' } }
  if ('error' in bearer) return { success: false, result: { error: bearer.error }, transient: bearer.error.includes('reach') }

  const url = `${base}/api/v1/check?number=${encodeURIComponent(withPlus(number, digits))}`
  let resp = await getWithRetry(url, bearer.token, fetchImpl, wait)
  // an expired JWT: get a fresh one and try once more (only possible when we hold the client credentials)
  if (resp?.status === 401 && bearer.refreshable) {
    const fresh = await bearerFor(base, env, fetchImpl, true)
    if (fresh && !('error' in fresh)) resp = await getWithRetry(url, fresh.token, fetchImpl, wait)
  }
  if (!resp) {
    console.error(`[pi/spam-check] unreachable after ${MAX_RETRIES + 1} attempts (…${digits.slice(-4)})`)
    return { success: false, result: { error: 'Could not reach the spam checker service' }, transient: true }
  }
  if (resp.status === 401 || resp.status === 403) return { success: false, result: { error: 'The spam checker rejected its credentials — they may be wrong or expired' } }
  if (resp.status === 400 || resp.status === 422) return { success: false, result: { error: 'The spam checker could not read that as a phone number — try it with the country code, like +919876543210' } }
  if (!resp.ok) {
    console.error(`[pi/spam-check] HTTP ${resp.status} (…${digits.slice(-4)})`)
    return { success: false, result: { error: `Spam checker failed (HTTP ${resp.status})` }, transient: resp.status >= 500 || resp.status === 429 }
  }

  const data: any = await resp.json().catch(() => null)
  if (!data || typeof data.is_spam !== 'boolean') return { success: false, result: { error: 'The spam checker returned an unexpected response' } }
  return {
    success: true,
    result: {
      phone_number: str(data.phone_number, 32) ?? digits,
      is_spam: data.is_spam,
      assessment: str(data.assessment),
      operator: str(data.operator, 64),
      country_code: str(data.country_code, 8),
    },
  }
}

const CACHE_TTL_MS = 10 * 60_000
const CACHE_MAX = 500
const BREAKER_FAILURES = 3
const BREAKER_OPEN_MS = 30_000
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 10 * 60_000

/**
 * Protects the service and the chat around checkSpamNumber: a short cache (repeat numbers cost nothing),
 * one in-flight call per number, a per-user rate limit, and a circuit breaker so an outage fails fast
 * instead of making every question wait out the retries.
 * ponytail: state is per server instance — on several instances the limits apply per instance;
 * move to Redis/Supabase if a hard global limit is needed.
 */
export function createGuardedSpamCheck({ check = checkSpamNumber, now = Date.now }: { check?: (n: unknown) => Promise<SpamResult>; now?: () => number } = {}) {
  const cache = new Map<string, { at: number; result: SpamResult }>()
  const inflight = new Map<string, Promise<SpamResult>>()
  const calls = new Map<string, number[]>()
  let failures = 0
  let openUntil = 0

  const strip = ({ success, result }: SpamResult): SpamResult => ({ success, result })

  return async (userId: string, number: unknown): Promise<SpamResult> => {
    const digits = digitsOf(number)
    // not a usable number: let the checker say so, and don't spend rate limit or a slot on it
    if (digits.length < 7 || digits.length > 15) return strip(await check(number))
    const t = now()

    const hit = cache.get(digits)
    if (hit && t - hit.at < CACHE_TTL_MS) return hit.result
    const pending = inflight.get(digits)
    if (pending) return strip(await pending)

    if (t < openUntil) return { success: false, result: { error: 'The spam checker is temporarily unavailable — try again in a minute' } }

    const recent = (calls.get(userId) ?? []).filter((at) => t - at < RATE_WINDOW_MS)
    if (recent.length >= RATE_LIMIT) {
      calls.set(userId, recent)
      return { success: false, result: { error: `Spam check limit reached (${RATE_LIMIT} per ${RATE_WINDOW_MS / 60_000} minutes) — try again later` } }
    }
    calls.set(userId, [...recent, t])

    const run = check(number)
    inflight.set(digits, run)
    try {
      const out = await run
      if (out.success) {
        failures = 0
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
        cache.set(digits, { at: now(), result: strip(out) })
      } else if (out.transient && ++failures >= BREAKER_FAILURES) {
        openUntil = now() + BREAKER_OPEN_MS
        failures = 0
      }
      return strip(out)
    } finally {
      inflight.delete(digits)
    }
  }
}
