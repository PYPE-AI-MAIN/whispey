// src/contexts/UserPermissionsContext.tsx
'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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
  refetchPermissions: () => Promise<void>
}

const UserPermissionsContext = createContext<UserPermissionsContextType | undefined>(undefined)

export const useUserPermissions = () => {
  const context = useContext(UserPermissionsContext)
  if (!context) {
    throw new Error('useUserPermissions must be used within UserPermissionsProvider')
  }
  return context
}

interface UserPermissionsProviderProps {
  children: ReactNode
}

export const UserPermissionsProvider: React.FC<UserPermissionsProviderProps> = ({ children }) => {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPermissions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/user/permissions')
      
      if (!response.ok) {
        throw new Error('Failed to fetch user permissions')
      }
      
      const data = await response.json()
      setPermissions(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions')
      console.error('Error fetching user permissions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [])

  const isWhitelisted = permissions?.roles?.type ? 
    ['ADMIN', 'SUPERADMIN', 'BETA'].includes(permissions.roles.type) : 
    false

  const canCreatePypeAgent = isWhitelisted

  return (
    <UserPermissionsContext.Provider 
      value={{
        permissions,
        loading,
        error,
        isWhitelisted,
        canCreatePypeAgent,
        refetchPermissions: fetchPermissions
      }}
    >
      {children}
    </UserPermissionsContext.Provider>
  )
}