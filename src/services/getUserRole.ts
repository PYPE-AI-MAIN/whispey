// src/services/getUserRole.ts
import { supabase } from "@/lib/supabase"

export async function getUserProjectRole(email: string, projectId: string) {
  
  try {
    const { data, error } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('role, permissions, is_active')
      .eq('email', email)
      .eq('project_id', projectId)
      // .eq('is_active', true)
      .maybeSingle()

    if (error) {
      return { role: 'user', permissions: null }
    }

    if (!data) {
      return { role: 'user', permissions: null }
    }

    const result = { 
      role: data.role || 'user',
      permissions: data.permissions
    }
    
    return result
    
  } catch (error) {
    return { role: 'user', permissions: null }
  }
}

export function canViewApiKeys(role: string): boolean {
  const allowedRoles = ['owner', 'admin']
  const canView = allowedRoles.includes(role)
  return canView
}

export function canManageApiKeys(role: string): boolean {
  const allowedRoles = ['owner', 'admin']
  const canManage = allowedRoles.includes(role)
  return canManage
}