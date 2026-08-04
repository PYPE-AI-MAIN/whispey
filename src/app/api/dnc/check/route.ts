import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkDncNumbers, toNumbersArray } from '@/lib/dnc'

export const runtime = 'nodejs'

/**
 * POST /api/dnc/check
 * Body: { numbers: string | string[], project_id?: string }
 *
 * Accepts a single number or an array (used by campaign upload for bulk checks
 * and by phone-call-config for a single number).
 *   200 -> nothing blocked            { blocked: false, results: [...] }
 *   406 -> at least one on the DNC     { blocked: true, results: [...], blocked_numbers: [...] }
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { numbers?: string | string[]; project_id?: string }
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
    const results = await checkDncNumbers(numbers, body.project_id ?? null)
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
    console.error('DNC check error:', error)
    return NextResponse.json({ error: 'DNC check failed' }, { status: 500 })
  }
}
