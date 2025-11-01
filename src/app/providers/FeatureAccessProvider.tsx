// app/providers/FeatureAccessProvider.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'

interface FeatureAccessContextType {
  isSuperAdmin: boolean
  userEmail: string | null
  isLoading: boolean
}

const FeatureAccessContext = createContext<FeatureAccessContextType>({
  isSuperAdmin: false,
  userEmail: null,
  isLoading: true,
})

export function useFeatureAccess() {
  const context = useContext(FeatureAccessContext)
  if (!context) {
    throw new Error('useFeatureAccess must be used within a FeatureAccessProvider')
  }
  return context
}

interface FeatureAccessProviderProps {
  children: React.ReactNode
}

export function FeatureAccessProvider({ children }: FeatureAccessProviderProps) {
  const { user, isLoaded } = useUser()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    const checkSuperAdmin = async () => {
      if (!user) {
        setIsSuperAdmin(false)
        setUserEmail(null)
        return
      }

      const email = user.emailAddresses?.[0]?.emailAddress
      setUserEmail(email || null)

      try {
        // ✅ Use new endpoint without project_id
        const response = await fetch('/api/user/check-access')
        
        if (!response.ok) {
          console.log('User access check failed, defaulting to non-superadmin')
          setIsSuperAdmin(false)
          return
        }

        const data = await response.json()
        setIsSuperAdmin(data.isSuperAdmin || false)

        console.log(`✅ User access loaded: ${data.isSuperAdmin ? 'SUPERADMIN' : 'Regular User'}`)
        
      } catch (error) {
        console.error('Error checking superadmin status:', error)
        setIsSuperAdmin(false)
      }
    }

    checkSuperAdmin()
  }, [user, isLoaded])

  return (
    <FeatureAccessContext.Provider
      value={{
        isSuperAdmin,
        userEmail,
        isLoading: !isLoaded,
      }}
    >
      {children}
    </FeatureAccessContext.Provider>
  )
}