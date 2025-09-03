import { supabase } from "@/lib/supabase"

export async function getUserProjectRole(email: string, projectId: string) {
  try {
    const { data, error } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('role')
      .eq('email', email)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user role:', error)
      return 'user'
    }

    // If no data found, return default role
    if (!data) {
      return 'user'
    }

    return data.role || 'user'
  } catch (error) {
    console.error('Unexpected error in getUserProjectRole:', error)
    return 'user'
  }
}