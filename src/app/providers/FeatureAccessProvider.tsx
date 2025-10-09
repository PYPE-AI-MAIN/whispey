// app/providers/FeatureAccessProvider.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { blacklistedEmails } from '@/utils/constants'

interface FeatureAccessContextType {
  canCreatePypeAgent: boolean
  canAccessPhoneCalls: boolean  // Add this
  userEmail: string | null
  isLoading: boolean
}

const FeatureAccessContext = createContext<FeatureAccessContextType>({
  canCreatePypeAgent: false,
  canAccessPhoneCalls: false,  // Add this
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
  const [canCreatePypeAgent, setCanCreatePypeAgent] = useState(false)
  const [canAccessPhoneCalls, setCanAccessPhoneCalls] = useState(false)  // Add this
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded) {
      const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase()
      setUserEmail(email || null)
      
      const isBlacklisted = email ? blacklistedEmails.includes(email) : false
      
      // Only allow Pype agent creation for blacklisted emails (internal team)
      setCanCreatePypeAgent(isBlacklisted)
      
      // Only allow phone calls access for blacklisted emails (internal team)
      setCanAccessPhoneCalls(isBlacklisted)  // Add this
    }
  }, [user, isLoaded])

  return (
    <FeatureAccessContext.Provider
      value={{
        canCreatePypeAgent,
        canAccessPhoneCalls,  // Add this
        userEmail,
        isLoading: !isLoaded,
      }}
    >
      {children}
    </FeatureAccessContext.Provider>
  )
}