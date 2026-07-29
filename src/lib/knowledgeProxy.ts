import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { mintServiceToken } from '@/lib/serviceToken'

/** Standard headers for proxying a knowledge-base request to the voice backend. */
export function knowledgeBackendHeaders(extra?: Record<string, string>): Record<string, string> {
  const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
  return {
    ...extra,
    'x-api-key': apiKey,
    Authorization: 'Bearer ' + mintServiceToken(),
  }
}

/**
 * Shared response handling for knowledge-base backend proxy calls: logs the
 * status, and on failure returns a ready-to-return NextResponse (mapping
 * 404/501 to a "not yet implemented" response, matching backend rollout gaps).
 * Returns null when the response was ok, so callers continue processing it.
 */
export async function handleKnowledgeBackendResponse(
  response: Response,
  logPrefix: string,
  step: number,
  fallbackMessage: string,
  notImplemented: { body: Record<string, unknown>; status: number }
): Promise<NextResponse | null> {
  console.log(`${logPrefix} Step ${step}: Backend responded status=${response.status} ${response.statusText}`)
  if (response.ok) return null

  const errorText = await response.text().catch(() => 'Unknown error')
  console.error(`${logPrefix} Step ${step} FAILED: Backend error body ->`, errorText)
  if (response.status === 404 || response.status === 501) {
    return NextResponse.json(notImplemented.body, { status: notImplemented.status })
  }
  return NextResponse.json({ error: errorText || fallbackMessage }, { status: response.status })
}

/**
 * Wraps a knowledge-base route handler with the standard "log request
 * received, catch unexpected errors as a 500" boilerplate shared by every
 * knowledge proxy route.
 */
export function withKnowledgeErrorHandling<Ctx = undefined>(
  logPrefix: string,
  handler: (request: NextRequest, ctx: Ctx) => Promise<Response>
): (request: NextRequest, ctx: Ctx) => Promise<Response> {
  return async (request, ctx) => {
    try {
      console.log(`${logPrefix} Step 1: Request received`)
      return await handler(request, ctx)
    } catch (error) {
      console.error(`${logPrefix} UNEXPECTED ERROR:`, error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
