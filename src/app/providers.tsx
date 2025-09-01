// app/providers.tsx
'use client'

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { usePostHog } from 'posthog-js/react'
import { useUser } from '@clerk/nextjs'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'

function PostHogUserIdentifier() {
  const { user, isLoaded } = useUser()
  const posthog = usePostHog()

  useEffect(() => {
    console.log('🔍 PostHogUserIdentifier effect triggered:', { isLoaded, hasUser: !!user })
    
    if (isLoaded && user) {
      // Get user email from Clerk
      const userEmail = user.emailAddresses?.[0]?.emailAddress
      console.log('👤 User data:', { 
        id: user.id, 
        email: userEmail, 
        firstName: user.firstName,
        emailAddresses: user.emailAddresses 
      })
      
      if (userEmail) {
        console.log('🔄 Resetting PostHog identity before identification...')
        // First reset any existing identity to ensure clean identification
        posthog.reset()
        
        // Small delay to ensure reset is processed
        setTimeout(() => {
          console.log('🎯 Identifying user in PostHog with email:', userEmail)
          
          // Identify user in PostHog with email as the unique identifier
          posthog.identify(userEmail, {
            email: userEmail,
            firstName: user.firstName,
            lastName: user.lastName,
            clerkId: user.id,
            createdAt: user.createdAt,
            lastSignInAt: user.lastSignInAt,
          })
          
          // Enable pageview tracking after identification
          posthog.capture('$pageview')
          
          // Session recording will automatically work for identified users
          console.log('✅ PostHog user identified with email:', userEmail)
          console.log('📊 PostHog current distinct_id:', posthog.get_distinct_id())
          
          // Verify the identification worked
          setTimeout(() => {
            console.log('🔍 Post-identification verification:', {
              distinct_id: posthog.get_distinct_id(),
              is_identified: posthog.get_distinct_id() === userEmail
            })
          }, 500)
        }, 100)
      } else {
        console.warn('⚠️ No email found for user, cannot identify in PostHog')
        console.log('👤 User object:', user)
      }
    } else if (isLoaded && !user) {
      // User signed out, reset PostHog identity
      console.log('🔄 User signed out, resetting PostHog identity')
      posthog.reset()
      console.log('🔄 PostHog identity reset (user signed out)')
    }
  }, [user, isLoaded, posthog])

  return null // This component doesn't render anything
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogUserIdentifier />
      {children}
    </PHProvider>
  )
}
