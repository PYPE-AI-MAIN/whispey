import { NextResponse } from 'next/server'
import { DataPlaneError } from './errors'
import { getDataPlaneResolver, type PlaneSource } from './resolver'

export type { PlaneSource }

/** Routes with their own try/catch call this first so a data-plane failure still becomes a 503. */
export function rethrowDataPlane(e: unknown): void {
  if (e instanceof DataPlaneError) throw e
}

/**
 * Route wrapper: hands the handler a plane source and maps data-plane errors to
 * HTTP 503 ("try again"). The handler resolves the plane after its own auth check:
 * `const plane = await dp.forProject(projectId)`.
 */
// ctx defaults to any: routes without params declare no third argument.
export function withDataPlane<Req, Ctx = any>(handler: (dp: PlaneSource, req: Req, ctx: Ctx) => Promise<Response>): (req: Req, ctx: Ctx) => Promise<Response> {
  // Next.js checks a route export's second argument, so it must be the handler's own (not optional).
  return async (req: Req, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(getDataPlaneResolver(), req, ctx)
    } catch (e) {
      if (!(e instanceof DataPlaneError)) throw e
      return NextResponse.json(
        { error: e.message, code: e.code, retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } }
      )
    }
  }
}
