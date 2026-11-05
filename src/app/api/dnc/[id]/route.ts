import { NextRequest, NextResponse } from 'next/server'
import { getSuperAdminEmail } from '@/lib/dnc'
import { withDataPlane, rethrowDataPlane } from '@/server/data-plane'
import { dncStoresFor } from '@/server/dnc/stores'

export const runtime = 'nodejs'

/**
 * DELETE /api/dnc/:id[?project_id=<uuid>]
 * `project_id` is the routing hint for project and agent entries (they live in the
 * project's data plane); omit it for a global entry.
 * Superadmin only. Soft-delete (is_active=false) to preserve the audit trail;
 * the row can be re-added later without losing history.
 */
export const DELETE = withDataPlane(async (dp, request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { scoped } = await dncStoresFor(dp, new URL(request.url).searchParams.get('project_id'))
  try {
    await scoped.deactivate(id)
  } catch (error) {
    rethrowDataPlane(error)
    console.error('DNC delete error:', error)
    return NextResponse.json({ error: 'Failed to remove number' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
})
