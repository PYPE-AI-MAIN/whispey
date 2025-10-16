// src/contexts/UserPermissionsContext.tsx
'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface UserPermissions {
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
  roles: {
    type: 'USER' | 'ADMIN' | 'SUPERADMIN' | 'BETA'
    level: number
    metadata: any
    permissions: string[]
  }
}

interface UserPermissionsContextType {
  permissions: UserPermissions | null
  loading: boolean
  error: string | null
  isWhitelisted: boolean
  canCreatePypeAgent: boolean
  refetchPermissions: () => void
}

const UserPermissionsContext = createContext<UserPermissionsContextType | undefined>(undefined)

export const useUserPermissions = () => {
  const context = useContext(UserPermissionsContext)
  if (!context) {
    throw new Error('useUserPermissions must be used within UserPermissionsProvider')
  }
  return context
}

// Query key for React Query
export const USER_PERMISSIONS_QUERY_KEY = ['user', 'permissions']

// Fetch function
const fetchUserPermissions = async (): Promise<UserPermissions | null> => {
  const response = await fetch('/api/user/users')
  
  if (!response.ok) {
    if (response.status === 404) {
      // User doesn't exist in database yet - treat as non-whitelisted
      console.log('User not found in database - treating as non-whitelisted')
      return null
    }
    throw new Error('Failed to fetch user permissions')
  }
  
  const data = await response.json()
  return data.data
}

interface UserPermissionsProviderProps {
  children: ReactNode
}

export const UserPermissionsProvider: React.FC<UserPermissionsProviderProps> = ({ children }) => {
  const queryClient = useQueryClient()

  const { data: permissions, isLoading: loading, error } = useQuery({
    queryKey: USER_PERMISSIONS_QUERY_KEY,
    queryFn: fetchUserPermissions,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  const isWhitelisted = permissions?.roles?.type ? 
    ['ADMIN', 'SUPERADMIN', 'BETA'].includes(permissions.roles.type) : 
    false

  const canCreatePypeAgent = isWhitelisted

  const refetchPermissions = () => {
    queryClient.invalidateQueries({ queryKey: USER_PERMISSIONS_QUERY_KEY })
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
  
  return () => {
    queryClient.invalidateQueries({ queryKey: USER_PERMISSIONS_QUERY_KEY })
  }
}