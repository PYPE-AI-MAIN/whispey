/**
 * Pi's spam/fraud lookup: GET {SCAM_CHECK_URL}/api/v1/check?number=… on the internal
 * Scam Checker service (JWT, token in SCAM_CHECK_TOKEN). Only a fixed set of typed
 * fields is passed back to the model — the service's free text is not trusted as
 * instructions, and the number is sent as digits only so it cannot alter the URL.
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

type SpamResult = { success: boolean; result: Record<string, unknown> }

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : null)

export async function checkSpamNumber(
  number: unknown,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<SpamResult> {
  const digits = String(number ?? '').replaceAll(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    return { success: false, result: { error: 'Give a phone number with 7–15 digits, e.g. 7988307935 or +919876543210' } }
  }
  const token = env.SCAM_CHECK_TOKEN?.trim()
  if (!token) return { success: false, result: { error: 'The spam checker is not configured (SCAM_CHECK_TOKEN is missing on the server)' } }

  const base = (env.SCAM_CHECK_URL?.trim() || DEFAULT_URL).replace(/\/$/, '')
  const url = `${base}/api/v1/check?number=${encodeURIComponent(digits)}`
  const init = () => ({ headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) })
  let resp: Response | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      resp = await fetchImpl(url, init())
      if (!RETRYABLE_STATUS.has(resp.status) || attempt === MAX_RETRIES) break
      await wait(retryDelay(attempt, resp.headers.get('retry-after')))
    } catch {
      resp = null
      if (attempt === MAX_RETRIES) break
      await wait(retryDelay(attempt, null))
    }
  }
  if (!resp) {
    console.error(`[pi/spam-check] unreachable after ${MAX_RETRIES + 1} attempts (…${digits.slice(-4)})`)
    return { success: false, result: { error: 'Could not reach the spam checker service' } }
  }
  if (resp.status === 401 || resp.status === 403) return { success: false, result: { error: 'The spam checker rejected its token — it may have expired' } }
  if (!resp.ok) {
    console.error(`[pi/spam-check] HTTP ${resp.status} (…${digits.slice(-4)})`)
    return { success: false, result: { error: `Spam checker failed (HTTP ${resp.status})` } }
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
