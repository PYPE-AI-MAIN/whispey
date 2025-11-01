// app/providers/FeatureAccessProvider.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'

interface FeatureAccessContextType {
  canCreatePypeAgent: boolean
  canAccessPhoneCalls: boolean
  userEmail: string | null
  isLoading: boolean
}

const FeatureAccessContext = createContext<FeatureAccessContextType>({
  canCreatePypeAgent: false,
  canAccessPhoneCalls: false,
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

// Parse the agent creation whitelist from environment variable
const getAgentCreationWhitelist = (): string[] => {
  const whitelist = process.env.NEXT_PUBLIC_AGENT_CREATION_WHITELIST || ''
  return whitelist
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0)
}

// Parse the phone calls whitelist from PostHog blacklist environment variable
const getPhoneCallsWhitelist = (): string[] => {
  const whitelist = process.env.NEXT_PUBLIC_POSTHOG_BLACKLIST || ''
  return whitelist
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0)
}

export function FeatureAccessProvider({ children }: FeatureAccessProviderProps) {
  const { user, isLoaded } = useUser()
  const [canCreatePypeAgent, setCanCreatePypeAgent] = useState(false)
  const [canAccessPhoneCalls, setCanAccessPhoneCalls] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded) {
      const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase()
      setUserEmail(email || null)
      
      // Check agent creation whitelist
      const agentWhitelist = getAgentCreationWhitelist()
      const canCreateAgent = email ? agentWhitelist.includes(email) : false
      setCanCreatePypeAgent(canCreateAgent)

      // Check phone calls whitelist (from PostHog blacklist)
      const phoneCallsWhitelist = getPhoneCallsWhitelist()
      const canAccessCalls = email ? phoneCallsWhitelist.includes(email) : false
      setCanAccessPhoneCalls(canAccessCalls)
    }
  }, [user, isLoaded])

  return (
    <FeatureAccessContext.Provider
      value={{
        canCreatePypeAgent,
        canAccessPhoneCalls,
        userEmail,
        isLoading: !isLoaded,
      }}
    >
      {children}
    </FeatureAccessContext.Provider>
  )
}