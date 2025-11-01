// src/contexts/UserPermissionsContext.tsx
'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface ProjectPermissions {
  id?: string
  agent: {
    usage: {
      active_count: number
    }
    agents: any[]
    limits: {
      max_agents: number
    }
    last_updated?: string
  }
  plans: {
    type: 'USER' | 'ADMIN' | 'SUPERADMIN' | 'BETA' | 'FREE' | 'PAID'
    level: number
    metadata: any
    permissions: string[]
  }
}

interface UserPermissionsContextType {
  permissions: ProjectPermissions | null
  loading: boolean
  error: string | null
  userProjectRole: string | null
  userProjectPermissions: {
    read: boolean
    write: boolean
    delete: boolean
    admin: boolean
    can_create_agents?: boolean
  } | null
  canCreatePypeAgent: boolean
  refetchPermissions: () => void
}

const UserPermissionsContext = createContext<UserPermissionsContextType | undefined>(undefined)

export const useUserPermissions = ({ projectId }: { projectId?: string }) => {
  const context = useContext(UserPermissionsContext)
  if (!context) {
    throw new Error('useUserPermissions must be used within UserPermissionsProvider')
  }
  return context
}

// Query key factory function
export const getUserPermissionsQueryKey = (projectId: string) => ['user', 'permissions', projectId]

// ✅ NEW: Single endpoint to fetch all project access data
const fetchProjectAccess = async (projectId: string) => {
  const response = await fetch(`/api/user/check-access?project_id=${projectId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    if (response.status === 404 || response.status === 403) {
      console.log('User does not have access to this project')
      return null
    }
    throw new Error('Failed to fetch project access')
  }
  
  const data = await response.json()
  
  if (!data.hasProjectAccess) {
    return null
  }
  
  return {
    role: data.role,
    permissions: data.permissions,
    agentData: data.agentData,
    projectPlan: data.projectPlan,
    isSuperAdmin: data.isSuperAdmin
  }
}

interface UserPermissionsProviderProps {
  children: ReactNode
  projectId: string
}

export const UserPermissionsProvider: React.FC<UserPermissionsProviderProps> = ({ children, projectId }) => {
  const queryClient = useQueryClient()

  // ✅ Single query to get all project access data
  const { data: accessData, isLoading, error } = useQuery({
    queryKey: getUserPermissionsQueryKey(projectId),
    queryFn: () => fetchProjectAccess(projectId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: !!projectId,
  })

  // ✅ Build permissions object from accessData
  const permissions: ProjectPermissions | null = React.useMemo(() => {
    if (!accessData) return null
    
    return {
      agent: accessData.agentData || {
        usage: { active_count: 0 },
        agents: [],
        limits: { max_agents: 0 }
      },
      plans: accessData.projectPlan || {
        type: 'FREE',
        level: 1,
        metadata: {},
        permissions: []
      }
    }
  }, [accessData])

  // ✅ Calculate if user can create agents
  // Must have can_create_agents permission in their project mapping
  const canCreatePypeAgent = React.useMemo(() => {
    if (!accessData) return false
    
    // Check explicit permission
    return accessData.permissions?.can_create_agents === true
  }, [accessData])

  const refetchPermissions = () => {
    queryClient.invalidateQueries({ queryKey: getUserPermissionsQueryKey(projectId) })
  }

  return (
    <UserPermissionsContext.Provider 
      value={{
        permissions,
        loading: isLoading,
        error: error?.message || null,
        userProjectRole: accessData?.role || null,
        userProjectPermissions: accessData?.permissions || null,
        canCreatePypeAgent,
        refetchPermissions
      }}
    >
      {children}
    </UserPermissionsContext.Provider>
  )
}

// Hook to invalidate user permissions from anywhere in the app
export const useInvalidateUserPermissions = () => {
  const queryClient = useQueryClient()
  
  return (projectId?: string) => {
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: getUserPermissionsQueryKey(projectId) })
    } else {
      queryClient.invalidateQueries({ queryKey: ['user', 'permissions'] })
    }
  }
}

// Export function to invalidate permissions cache
export const invalidatePermissionsCache = (queryClient: any, projectId?: string) => {
  if (projectId) {
    queryClient.invalidateQueries({ queryKey: getUserPermissionsQueryKey(projectId) })
  } else {
    queryClient.invalidateQueries({ queryKey: ['user', 'permissions'] })
  }
}