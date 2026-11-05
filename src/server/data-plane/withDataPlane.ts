import { NextResponse } from 'next/server'
import { DataPlaneError } from './errors'
import type { DataPlane } from './ports'
import { getDataPlaneResolver } from './resolver'

export type PlaneSource = { forProject(projectId: string): Promise<DataPlane> }

/** Routes with their own try/catch call this first so a data-plane failure still becomes a 503. */
export function rethrowDataPlane(e: unknown): void {
  if (e instanceof DataPlaneError) throw e
}

/**
 * Route wrapper: hands the handler a plane source and maps data-plane errors to
 * HTTP 503 ("try again"). The handler resolves the plane after its own auth check:
 * `const plane = await dp.forProject(projectId)`.
 */
export function withDataPlane<Req, Ctx = unknown>(
  handler: (dp: PlaneSource, req: Req, ctx: Ctx) => Promise<Response>
): (req: Req, ctx?: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(getDataPlaneResolver(), req, ctx as Ctx)
    } catch (e) {
      if (!(e instanceof DataPlaneError)) throw e
      return NextResponse.json(
        { error: e.message, code: e.code, retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } }
      )
    }
  }
}
