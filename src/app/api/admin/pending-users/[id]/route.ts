import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'
import { approvePendingUser, declinePendingUser } from '@/lib/pendingUserActions'

export const runtime = 'nodejs'

// Approval no longer assigns a project — an approved user creates their own
// organization via /onboarding, same as any new signup would. This route is
// just the admin-UI entry point into the same state machine the email
// Approve/Decline links use (see pendingUserActions.ts) — pending is a
// one-way fork into active or declined, terminal either way, from either path.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await currentUser()
  if (!isPlatformAdmin(caller?.emailAddresses?.[0]?.emailAddress)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: targetUserId } = await params
  const { action } = (await request.json()) as { action: 'approve' | 'decline' }

  if (action !== 'approve' && action !== 'decline') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const result =
    action === 'approve'
      ? await approvePendingUser(supabase, targetUserId)
      : await declinePendingUser(supabase, targetUserId)

  if (!result.ok) {
    return NextResponse.json({ error: 'This request has already been decided' }, { status: 409 })
  }

  return NextResponse.json({ status: action === 'approve' ? 'approved' : 'declined' })
}
