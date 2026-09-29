/**
 * The last line before an unhandled throw becomes an HTML 500.
 *
 * Every route here already handles what it expects to go wrong — a bad body, a
 * denied agent, a timeout, a spec the compiler rejects. This is for what nobody
 * expected. Without it Next.js answers with an error page, `res.json()` on the
 * other end fails to parse it, and the person is told "Something went wrong
 * (500)" while the actual cause goes nowhere.
 */
import { NextResponse } from 'next/server'
import { isTimeout } from '@/server/analytics/db'
import { SpecError, InternalSpecError } from '@/server/analytics/buildQuery'

export function guarded<T extends unknown[]>(name: string, handler: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (err) {
      console.error(`[${name}] unhandled`, err)
      return NextResponse.json({ error: 'Something went wrong. The problem has been logged.' }, { status: 500 })
    }
  }
}

/** Maps the well-known spec/db failure modes a route's `try`/`catch` expects into a response. */
export function specErrorResponse(name: string, err: unknown, fallback: string): NextResponse {
  if (isTimeout(err)) return NextResponse.json({ error: 'That took too long. Try a shorter date range.' }, { status: 504 })
  if (err instanceof SpecError) return NextResponse.json({ error: err.message }, { status: 400 })
  if (err instanceof InternalSpecError) {
    console.error(`[${name}] compiler bug`, err.message)
    return NextResponse.json({ error: 'Could not load this. The problem has been logged.' }, { status: 500 })
  }
  console.error(`[${name}]`, err)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
