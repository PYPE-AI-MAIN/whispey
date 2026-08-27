import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

export async function getCallerGlobalRole(userId: string): Promise<string> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('pype_voice_users')
    .select('roles, email')
    .eq('clerk_id', userId)
    .single()
  // Platform admins (PYPE_ADMINS) get full superadmin-equivalent access —
  // one directional: this doesn't grant a DB superadmin the approval-gate's
  // PYPE_ADMINS-only powers (accept/decline, gate bypass), only the reverse.
  if (isPlatformAdmin(data?.email)) return 'superadmin'
  return data?.roles?.globalRole ?? 'user'
}
