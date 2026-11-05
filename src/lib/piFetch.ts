/**
 * fetch with retry for the chat request only. Retrying is safe there because nothing Pi can write
 * runs until the user clicks Confirm, so a repeated turn changes no data. Retries network errors and
 * 429/502/503/504 with exponential backoff + jitter; any other status is returned for the caller to show.
 * Do NOT use this for a Confirm click or a form submit — those are not idempotent.
 */
const RETRYABLE = new Set([429, 502, 503, 504])

export async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  { retries = 2, baseMs = 400, wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)), fetchImpl = fetch }: {
    retries?: number; baseMs?: number; wait?: (ms: number) => Promise<void>; fetchImpl?: typeof fetch
  } = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchImpl(url, init)
      if (!RETRYABLE.has(res.status) || attempt >= retries) return res
      const retryAfter = Number(res.headers.get('retry-after'))
      await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : baseMs * 2 ** attempt + Math.random() * baseMs)
    } catch (err) {
      if (attempt >= retries) throw err
      await wait(baseMs * 2 ** attempt + Math.random() * baseMs)
    }
  }
}
