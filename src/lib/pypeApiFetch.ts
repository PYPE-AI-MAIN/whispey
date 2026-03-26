/** Timeout for quick read requests (status checks, config fetches). */
export const PYPE_API_FETCH_TIMEOUT_MS = 8_000

/**
 * Timeout for agent config deploy — updating a running agent requires restarting
 * its worker process on the backend which takes significantly longer than a read.
 * Must be set via PYPE_DEPLOY_TIMEOUT_SEC env var (in seconds).
 */
export const PYPE_API_DEPLOY_TIMEOUT_MS =
  parseInt(process.env.PYPE_DEPLOY_TIMEOUT_SEC || '', 10) * 1_000

/**
 * Base URL for server-side routes that proxy to the voice/inference API.
 * Prefer `PYPEAI_API_URL` (server-only, e.g. http://127.0.0.1:8000) so local dev can
 * override an unreachable `NEXT_PUBLIC_PYPEAI_API_URL` without changing the client bundle.
 */
export function getPypeApiBaseUrlForServer(): string | undefined {
  return process.env.PYPEAI_API_URL || process.env.NEXT_PUBLIC_PYPEAI_API_URL
}

export function pypeApiAbortSignal(timeoutMs = PYPE_API_FETCH_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(timeoutMs)
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
