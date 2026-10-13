import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

export const runtime = 'nodejs'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('pype_voice_users')
    .select('roles, email')
    .eq('clerk_id', userId)
    .single()

  // Platform admins (PYPE_ADMINS) get full superadmin-equivalent access —
  // same one-directional rule as getCallerGlobalRole in prod-auth.ts.
  const globalRole: string = isPlatformAdmin(data?.email) ? 'superadmin' : data?.roles?.globalRole ?? 'user'
  return NextResponse.json({ globalRole })
}
