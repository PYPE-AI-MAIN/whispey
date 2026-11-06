// Readiness check — used by the deploy pipeline to confirm a freshly started
// container is actually able to serve traffic before it's cut over to.
//
// Checks the app process itself (trivial — if this handler runs, it's alive)
// plus the one hard dependency nearly every request needs: the database.
// Hits Supabase's REST root instead of a specific table, so this stays
// correct even if the schema changes — it only proves "can we reach Postgres
// through PostgREST," not "does table X exist."
//
// Deliberately does NOT check third-party services (Clerk, LiveKit, OpenAI,
// S3, ElevenLabs, etc.) — those are used per-feature, not on every request,
// so checking them here would make deploys fail on unrelated third-party
// blips. If a specific dependency later becomes as critical as the DB, add
// it the same way: a timeout-guarded check contributing to `checks`.

const DEPENDENCY_TIMEOUT_MS = 3000

async function checkSupabase(): Promise<'ok' | 'error'> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return 'error'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEPENDENCY_TIMEOUT_MS)

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key },
      signal: controller.signal,
      cache: 'no-store',
    })
    return res.ok ? 'ok' : 'error'
  } catch {
    return 'error'
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET() {
  const checks = {
    app: 'ok' as const,
    supabase: await checkSupabase(),
  }

  const healthy = checks.supabase === 'ok'

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      version: process.env.APP_VERSION ?? null,
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
