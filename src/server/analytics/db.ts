/**
 * The analytics database connection — Confluence "Analytics Phase 1 and 2 —
 * Build Spec" §9.2. Everything else in the app talks to Supabase through
 * PostgREST; analytics cannot, because PostgREST does not aggregate. This is
 * the only place in the codebase that opens a raw Postgres connection.
 *
 * Connection exhaustion is the usual way a Next.js app on Vercel takes Supabase
 * down, and it is a configuration mistake rather than a code bug. Three things
 * prevent it here: the transaction pooler on port 6543 (serverless functions do
 * not keep connections alive), a bounded pool per running instance, and a
 * statement timeout on every query so a slow one gives its connection back.
 *
 * Sized for Fluid Compute, not classic serverless: one warm instance now
 * serves many concurrent requests and reuses this same pool, rather than a
 * fresh isolate (and a fresh pool) per invocation. Vercel's own guidance for
 * that model is to keep a real pool (never max: 1 — it doesn't cut total
 * connections and only kills concurrency) and let it stay warm. A pool of 4
 * meant a twelve-chart dashboard ran in three serial rounds; one slow round
 * held up every chart behind it, which is what "sometimes takes too long"
 * looked like from the browser even after the query itself got fast.
 */
import { Pool, type PoolClient } from 'pg'

/** The Edge runtime cannot load a Postgres driver. Every analytics route re-exports this. */
export const runtime = 'nodejs'

/** Per query. The database default is 2 minutes, which is far too long to hold a connection. */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Measured: a chart's SQL costs this database almost nothing — `SELECT 1` takes
 * 312ms and a real chart 262ms, so the whole cost is three round trips to
 * another region (BEGIN + SET, the query, COMMIT).
 *
 * Startup options would remove two of them, but the transaction pooler refuses
 * them: "unsupported startup parameter: options". A session-level SET is worse —
 * under transaction pooling it lands on whichever server connection the pooler
 * happened to pick. Setting it on a dedicated database role is the real fix and
 * needs a role to exist; until then the answer is fewer queries, not fewer round
 * trips per query.
 */

declare global {
  var __analyticsPool: Pool | undefined
}

function pool(): Pool {
  if (globalThis.__analyticsPool) return globalThis.__analyticsPool

  const connectionString = process.env.SUPABASE_POOLER_URL
  if (!connectionString) {
    throw new Error('SUPABASE_POOLER_URL is not set — analytics needs the transaction pooler (port 6543)')
  }
  if (!connectionString.includes(':6543')) {
    // port 5432 is session mode: one connection per function invocation, held
    // until it times out. It will exhaust the database under any real load.
    throw new Error('SUPABASE_POOLER_URL must use the transaction pooler on port 6543, not 5432')
  }

  const created = new Pool({
    connectionString,
    // pool size is per running instance, so the ceiling is max × peak
    // instances. Through the transaction pooler these are pooler connections
    // rather than the database's own 60. 10 matches Vercel's own sizing for a
    // warm Fluid Compute pool; check the project's pooler client limit
    // (Supabase dashboard → Database → Connection Pooling) before raising it
    // further — this ceiling is shared with every other agent's dashboard.
    max: 10,
    min: 1,
    // short, per Vercel's Fluid Compute guidance — an idle connection held
    // longer than it needs to be is one less slot for someone else's query
    // against the same shared pooler limit.
    idleTimeoutMillis: 5_000,
    // a dashboard sends its charts together and the pool holds 10, so most of
    // them queue here. Waiting is correct; statement_timeout bounds how long
    // any one of them can make the others wait.
    connectionTimeoutMillis: 30_000,
    // Supabase terminates TLS at the pooler with its own certificate chain
    ssl: { rejectUnauthorized: false },
  })
  created.on('error', (err) => console.error('[analytics] idle client error', err))

  // survives hot reload in dev, where a new module instance would otherwise
  // open a new pool on every edit
  globalThis.__analyticsPool = created
  return created
}

export type Row = Record<string, unknown>

/**
 * One query, with its own timeout, on a connection that is always given back.
 *
 * `SET LOCAL` needs a transaction, which also matches what the transaction
 * pooler hands out — the connection is ours only for the length of it.
 */
export async function runQuery<T extends Row = Row>(
  sql: string,
  params: unknown[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T[]> {
  const waitStarted = Date.now()
  const client: PoolClient = await pool().connect()
  // time spent waiting for a free connection, not running the query — the
  // one number that told us "queued behind the pool" and "the query itself
  // is slow" apart, instead of both looking like the same timeout to a user
  const queuedMs = Date.now() - waitStarted
  if (queuedMs > 2_000) console.warn(`[analytics] queued ${queuedMs}ms for a pool connection`)
  try {
    // one round trip for the setup, not three: BEGIN and both SETs go together.
    // statement_timeout is bounded above so a caller cannot ask to hold a
    // connection indefinitely; TimeZone stays UTC because the query builder
    // converts to the project's zone explicitly.
    await client.query(
      `BEGIN READ ONLY;` +
      `SET LOCAL statement_timeout = ${Math.min(Math.max(timeoutMs, 1000), 55_000)};` +
      `SET LOCAL TimeZone = 'UTC';`
    )
    const result = await client.query<T>(sql, params)
    await client.query('COMMIT')
    return result.rows
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Postgres cancelled the query at statement_timeout — a slow chart, not a broken one. */
export function isTimeout(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '57014'
}
