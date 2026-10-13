import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

export const runtime = 'nodejs'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress
  if (isPlatformAdmin(userEmail)) return NextResponse.json({ status: 'active', isPlatformAdmin: true })

  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('pype_voice_users')
    .select('approval_status')
    .eq('clerk_id', userId)
    .maybeSingle()

  // Mirrors middleware.ts exactly: grandfather a row that predates this gate
  // (approval_status NULL) as active, but fail closed (pending) when no row
  // exists at all yet — otherwise this endpoint could tell a blocked user
  // they're "active" while middleware still blocks every other route,
  // causing a redirect loop on /pending-approval.
  const raw = data?.approval_status
  const status: 'pending' | 'active' | 'declined' =
    data === null ? 'pending' : raw === 'pending' || raw === 'declined' ? raw : 'active'

  return NextResponse.json({ status, isPlatformAdmin: false })
}
