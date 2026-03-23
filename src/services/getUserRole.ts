// src/services/getUserRole.ts
import { supabase } from "@/lib/supabase"

export async function getUserProjectRole(
  email: string,
  projectId: string,
  clerkId?: string | null
) {
  try {
    let query = supabase
      .from('pype_voice_email_project_mapping')
      .select('role, permissions, is_active')
      .eq('project_id', projectId)

    if (clerkId && clerkId.trim() !== '' && email && email.trim() !== '') {
      query = query.or(`clerk_id.eq.${clerkId},email.ilike.${email}`)
    } else if (clerkId && clerkId.trim() !== '') {
      query = query.eq('clerk_id', clerkId)
    } else {
      query = query.eq('email', email)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return { role: 'user', permissions: null }
    }

    if (!data) {
      return { role: 'user', permissions: null }
    }

    const normalizedRole = ['user', 'member', 'viewer'].includes(data.role) ? 'viewer' : data.role
    const result = { 
      role: normalizedRole || 'user',
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