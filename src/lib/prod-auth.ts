import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase-server'

export async function getCallerGlobalRole(userId: string): Promise<string> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('pype_voice_users')
    .select('roles')
    .eq('clerk_id', userId)
    .single()
  return data?.roles?.globalRole ?? 'user'
}
