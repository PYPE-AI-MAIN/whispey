// Reanalyzing chosen calls (Call Logs → select → Reanalyze). The analytics
// lambda's reprocess-call-logs job takes a date range; one request per call,
// with from and to both set to that call's exact created_at, matches exactly
// that call. So this needs no change to the lambda.

export const MAX_REANALYZE_LOG_IDS = 500

/** How many calls are sent to the lambda at once. */
export const REANALYZE_CONCURRENCY = 5

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Unique, valid call log ids, or an error to show. */
export function parseLogIds(raw: unknown): { ids: string[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'log_ids must be a non-empty array' }
  const ids = [...new Set(raw)]
  if (ids.some((id) => typeof id !== 'string' || !UUID.test(id))) return { error: 'log_ids must be call log ids' }
  if (ids.length > MAX_REANALYZE_LOG_IDS) return { error: `Reanalyze at most ${MAX_REANALYZE_LOG_IDS} calls at a time` }
  return { ids: ids as string[] }
}

/** Run `fn` on every item, at most `limit` at a time; returns each result in order. */
export async function runLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
