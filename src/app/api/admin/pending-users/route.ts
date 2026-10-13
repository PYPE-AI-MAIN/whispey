import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

export const runtime = 'nodejs'

// Full history of everyone who's gone through the signup-approval gate —
// not just currently-pending ones — so resolved requests stay visible with
// their final status.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await currentUser()
  if (!isPlatformAdmin(user?.emailAddresses?.[0]?.emailAddress)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_users')
    .select('id, email, first_name, last_name, profile_image_url, created_at, approval_status')
    .not('approval_status', 'is', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users: data ?? [] })
}
