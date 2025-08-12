// Mock User Role Service - No Database Required!

export async function getUserRole(userId: string, projectId: string): Promise<string> {
  // Mock: always return 'owner' role
  return 'owner'
}

export async function checkUserAccess(userId: string, projectId: string): Promise<boolean> {
  // Mock: always allow access
  return true
}

export async function getUserPermissions(userId: string, projectId: string): Promise<any> {
  // Mock: return full permissions
  return {
    read: true,
    write: true,
    delete: true,
    admin: true
  }
}

export async function getUserProjectRole(userId: string, projectId: string): Promise<string> {
  // Mock: always return 'owner' role (alias for getUserRole)
  return 'owner'
}