import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { mintServiceToken } from '@/lib/serviceToken'

type Query = Record<string, string | null | undefined>

/**
 * One call to the campaign scheduler, with the caller's identity forwarded.
 * The base comes only from server env (never user input) and the final origin is
 * checked against it. Signed-out callers never reach the scheduler (401).
 */
export async function callScheduler(
  path: string,
  opts: { method?: string; query?: Query; body?: BodyInit; contentType?: string; projectId?: string } = {}
): Promise<{ res: Response } | { error: NextResponse }> {
  const { userId } = await auth()
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
  if (!rawBase) return { error: NextResponse.json({ error: 'Service misconfigured' }, { status: 500 }) }

  const trustedBase = new URL(rawBase)
  const url = new URL(trustedBase.href)
  url.pathname = `${trustedBase.pathname.replace(/\/$/, '')}/api/v1/${path}`
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v) url.searchParams.set(k, v)
  if (url.origin !== trustedBase.origin) {
    return { error: NextResponse.json({ error: 'Invalid request target' }, { status: 400 }) }
  }

  const headers: Record<string, string> = {
    'Content-Type': opts.contentType ?? 'application/json',
    Authorization: `Bearer ${mintServiceToken()}`,
    'x-pype-user-id': userId,
  }
  if (opts.projectId) headers['x-pype-project-id'] = opts.projectId
  const res = await fetch(url.toString(), { method: opts.method ?? 'GET', headers, body: opts.body })
  return { res }
}

/** Passes a scheduler answer through, or its `error` with the same status. */
export async function relay(res: Response, fallback: string): Promise<NextResponse> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json({ error: data.error || fallback }, { status: res.status })
  return NextResponse.json(data)
}
