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
