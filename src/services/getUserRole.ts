import { supabase } from "@/lib/supabase"

export async function getUserProjectRole(email: string, projectId: string) {
  const { data, error } = await supabase
    .from('pype_voice_email_project_mapping')
    .select('role')
    .eq('email', email)
    .eq('project_id', projectId)
    .eq('is_active', true)
    .single()

  if (error || !data?.role) {
    return 'user'
  }
  return data.role
}
