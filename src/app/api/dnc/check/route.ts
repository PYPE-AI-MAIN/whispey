import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkDncNumbers, toNumbersArray } from '@/lib/dnc'
import { withDataPlane, rethrowDataPlane } from '@/server/data-plane'
import { dncProjectId, dncStoresFor } from '@/server/dnc/stores'

export const runtime = 'nodejs'

/**
 * POST /api/dnc/check
 * Body: { numbers: string | string[], project_id?: string, agent_id?: string }
 * With agent_id, numbers on that agent's own DNC list are blocked too.
 *
 * Accepts a single number or an array (used by campaign upload for bulk checks
 * and by phone-call-config for a single number).
 *   200 -> nothing blocked            { blocked: false, results: [...] }
 *   406 -> at least one on the DNC     { blocked: true, results: [...], blocked_numbers: [...] }
 */
export const POST = withDataPlane(async (dp, request: NextRequest) => {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { numbers?: string | string[]; project_id?: string; agent_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const numbers = toNumbersArray(body.numbers)
  if (numbers.length === 0) {
    return NextResponse.json({ error: '`numbers` is required (string or array)' }, { status: 400 })
  }

  try {
    // Global entries are checked in Pype; project and agent entries also in a customer-held project's destination.
    const { all } = await dncStoresFor(dp, await dncProjectId(body.project_id, body.agent_id))
    const results = await checkDncNumbers(numbers, body.project_id ?? null, body.agent_id ?? null, all)
    const blocked = results.filter((r) => r.blocked)
    return NextResponse.json(
      {
        blocked: blocked.length > 0,
        results,
        blocked_numbers: blocked.map((r) => r.normalized),
      },
      { status: blocked.length > 0 ? 406 : 200 }
    )
  } catch (error) {
    rethrowDataPlane(error)
    console.error('DNC check error:', error)
    return NextResponse.json({ error: 'DNC check failed' }, { status: 500 })
  }
})
