// src/services/getUserRole.ts

export async function getUserProjectRole(
  email: string,
  projectId: string,
  clerkId?: string | null
) {
  try {
    void email
    void clerkId
    const response = await fetch(`/api/projects/${projectId}/me`, {
      method: 'GET',
      credentials: 'same-origin',
    })
    if (!response.ok) {
      return { role: 'user', permissions: null }
    }
    const data = await response.json().catch(() => null)
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