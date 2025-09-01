// app/providers.tsx
'use client'

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { usePostHog } from 'posthog-js/react'
import { useUser } from '@clerk/nextjs'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { blacklistedEmails } from "@/utils/constants"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    // Initialize PostHog
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      before_send: (event: any) => {
        // Check multiple possible email properties
        const userEmail = event.properties?.$user_email || 
                         event.properties?.email || 
                         event.properties?.$email ||
                         posthog.get_property('email'); // Get from identified user properties
        
        if (userEmail && blacklistedEmails.includes(userEmail.toLowerCase())) {
          console.log('🚫 Blocking event for blacklisted email:', userEmail);
          return null; // Don't send this event
        }
        return event;
      },
      // Disable automatic pageview tracking until user is identified
      capture_pageview: false,
    })
    
    console.log('🚀 PostHog initialized')
  }, [])

  // Handle user identification after PostHog is initialized
  useEffect(() => {
    console.log('🔍 PostHogUserIdentifier effect triggered:', { isLoaded, hasUser: !!user })
    
    if (isLoaded && user) {
      // Get user email from Clerk
      const userEmail = user.emailAddresses?.[0]?.emailAddress
      console.log('👤 User data:', { 
        id: user.id, 
        email: userEmail, 
        firstName: user.firstName,
      })
      
      if (userEmail) {
        // Check if user is blacklisted before identifying
        if (blacklistedEmails.includes(userEmail.toLowerCase())) {
          console.log('🚫 User email is blacklisted, skipping PostHog identification:', userEmail);
          // Optionally disable session recording for blacklisted users
          posthog.stopSessionRecording();
          return;
        }

        console.log('🔄 Resetting PostHog identity before identification...')
        posthog.reset()
        
        setTimeout(() => {
          console.log('🎯 Identifying user in PostHog with email:', userEmail)
          
          // Identify user in PostHog
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
          
          console.log('✅ PostHog user identified with email:', userEmail)
        }, 100)
      } else {
        console.warn('⚠️ No email found for user, cannot identify in PostHog')
      }
    } else if (isLoaded && !user) {
      console.log('🔄 User signed out, resetting PostHog identity')
      posthog.reset()
    }
  }, [user, isLoaded])

  return (
    <PHProvider client={posthog}>
      {children}
    </PHProvider>
  )
}