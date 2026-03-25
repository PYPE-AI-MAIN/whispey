/** Timeout for outbound requests to the Pype inference API (avoids 10s+ hangs when host is unreachable). */
export const PYPE_API_FETCH_TIMEOUT_MS = 8_000

/**
 * Base URL for server-side routes that proxy to the voice/inference API.
 * Prefer `PYPEAI_API_URL` (server-only, e.g. http://127.0.0.1:8000) so local dev can
 * override an unreachable `NEXT_PUBLIC_PYPEAI_API_URL` without changing the client bundle.
 */
export function getPypeApiBaseUrlForServer(): string | undefined {
  return process.env.PYPEAI_API_URL || process.env.NEXT_PUBLIC_PYPEAI_API_URL
}

export function pypeApiAbortSignal(): AbortSignal {
  return AbortSignal.timeout(PYPE_API_FETCH_TIMEOUT_MS)
}

/** True when fetch failed due to timeout, DNS, or refused connection (not HTTP 4xx/5xx). */
export function isPypeUpstreamUnreachable(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false
  const e = err as Error & { cause?: { code?: string } }
  if (e.name === "AbortError" || e.name === "TimeoutError") return true
  const code = e.cause?.code
  if (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_SOCKET" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  ) {
    return true
  }
  if (e instanceof TypeError && /fetch failed/i.test(String(e.message))) {
    return true
  }
  return false
}
