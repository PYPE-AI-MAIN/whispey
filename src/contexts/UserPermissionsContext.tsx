// src/contexts/UserPermissionsContext.tsx
'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface ProjectPermissions {
  id: string
  agent: {
    usage: {
      active_count: number
    }
    agents: any[]
    limits: {
      max_agents: number
    }
    last_updated: string
  }
  plans: {
    type: 'USER' | 'ADMIN' | 'SUPERADMIN' | 'BETA'
    level: number
    metadata: any
    permissions: string[]
  }
}

interface UserPermissionsContextType {
  permissions: ProjectPermissions | null
  loading: boolean
  error: string | null
  isWhitelisted: boolean
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

// Query key factory function - UPDATED to include projectId
export const getUserPermissionsQueryKey = (projectId: string) => ['user', 'permissions', projectId]

// Fetch function
export const fetchProjectPermissions = async (projectId: string): Promise<ProjectPermissions | null> => {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    if (response.status === 404) {
      console.log('Project not found in database - treating as non-whitelisted')
      return null
    }
    throw new Error('Failed to fetch project permissions')
  }
  
  const data = await response.json()
  return data.data
}

interface UserPermissionsProviderProps {
  children: ReactNode
  projectId: string
}

export const UserPermissionsProvider: React.FC<UserPermissionsProviderProps> = ({ children, projectId }) => {
  const queryClient = useQueryClient()

  const { data: permissions, isLoading: loading, error } = useQuery({
    queryKey: getUserPermissionsQueryKey(projectId),
    queryFn: () => fetchProjectPermissions(projectId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: !!projectId,
  })

  const isWhitelisted = permissions?.plans?.type ?
    ['ADMIN', 'SUPERADMIN', 'BETA'].includes(permissions.plans.type) : 
    false

  const canCreatePypeAgent = isWhitelisted

  const refetchPermissions = () => {
    queryClient.invalidateQueries({ queryKey: getUserPermissionsQueryKey(projectId) })
  }

  return (
    <UserPermissionsContext.Provider 
      value={{
        permissions: permissions || null,
        loading,
        error: error?.message || null,
        isWhitelisted,
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
      // Invalidate specific project
      queryClient.invalidateQueries({ queryKey: getUserPermissionsQueryKey(projectId) })
    } else {
      // Invalidate all user permissions
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