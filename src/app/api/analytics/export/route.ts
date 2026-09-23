/**
 * One page of a CSV export — Confluence "Analytics Phase 1 and 2 — Build Spec"
 * §9.4. The browser calls this repeatedly, following the cursor, and assembles
 * the file.
 *
 * Not streamed on purpose: a stream keeps a serverless function alive and holds
 * a database connection for the whole download, and a slow connection on the
 * other end kills it halfway with nothing saved.
 *
 * The CSV is written here rather than in the browser so the formula guard and
 * the byte-order mark live in one place.
 */
import { NextRequest, NextResponse } from 'next/server'
import { RowsBody, fetchRowPage, ROW_COLUMNS } from '@/server/analytics/rowsRequest'
import { resolveAnalyticsContext, isDenied } from '@/server/analytics/context'
import { isTimeout } from '@/server/analytics/db'
import { SpecError, InternalSpecError } from '@/server/analytics/buildQuery'
import { csvPage } from '@/server/analytics/csv'
import { guarded } from '@/server/analytics/guard'

export const runtime = 'nodejs'
// the pooler is aws-1-ap-south-1 (Mumbai); without this the function runs
// wherever Vercel's project default is, which can add a cross-region round
// trip to every statement in runQuery (BEGIN, SET LOCAL, the query, COMMIT)
export const preferredRegion = 'bom1'
export const dynamic = 'force-dynamic'

export const POST = guarded('analytics/export', async (req: NextRequest) => {
  const parsed = RowsBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const resolved = await resolveAnalyticsContext(parsed.data.agentId, { forDownload: true })
  if (isDenied(resolved)) return resolved.errorResponse
  if (resolved.downloadDisabled) {
    return NextResponse.json({ error: 'Downloads are turned off for your account' }, { status: 403 })
  }

  try {
    const { rows, nextCursor } = await fetchRowPage(parsed.data, resolved.ctx, resolved.agent.outcomeRanking, 'export')
    const columns = [...ROW_COLUMNS, ...(rows[0] && 'series' in rows[0] ? ['series'] : [])]
    const isFirstPage = !parsed.data.cursor

    return new NextResponse(csvPage(columns, rows, isFirstPage), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
        // the browser follows this to ask for the next page; absent means done
        ...(nextCursor ? { 'X-Next-Cursor': Buffer.from(JSON.stringify(nextCursor)).toString('base64') } : {}),
      },
    })
  } catch (err) {
    if (isTimeout(err)) return NextResponse.json({ error: 'That took too long. Try a shorter date range.' }, { status: 504 })
    if (err instanceof SpecError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof InternalSpecError) {
      console.error('[analytics/export] compiler bug', err.message)
      return NextResponse.json({ error: 'Could not load this. The problem has been logged.' }, { status: 500 })
    }
    console.error('[analytics/export]', err)
    return NextResponse.json({ error: 'Could not build the export' }, { status: 500 })
  }
})
