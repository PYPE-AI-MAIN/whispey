// app/providers.tsx
'use client'

import { useEffect } from "react"
import { useUser } from '@clerk/nextjs'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { blacklistedEmails } from "@/utils/constants"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    try {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
        persistence: 'localStorage',
        cross_subdomain_cookie: false,
        secure_cookie: true,
        autocapture: false,
        capture_heatmaps: false,
        disable_session_recording: false,
        before_send: (event: any) => {
          const userEmail = event.properties?.$user_email || 
                           event.properties?.email || 
                           event.properties?.$email ||
                           posthog.get_property('email');
          
          if (userEmail && blacklistedEmails.includes(userEmail.toLowerCase())) {
            return null;
          }
          return event;
        },
      })
    } catch (error) {
      console.error('PostHog init error:', error)
    }
  }, [])

  // Handle user identification after PostHog is initialized
  useEffect(() => {
    
    if (isLoaded && user) {
      // Get user email from Clerk
      const userEmail = user.emailAddresses?.[0]?.emailAddress
      
      if (userEmail) {
        // Check if user is blacklisted before identifying
        if (blacklistedEmails.includes(userEmail.toLowerCase())) {
          // Optionally disable session recording for blacklisted users
          posthog.stopSessionRecording();
          return;
        }

        posthog.reset()
        
        setTimeout(() => {
          
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
          
        }, 100)
      } else {
      }
    } else if (isLoaded && !user) {
      posthog.reset()
    }
  }, [user, isLoaded])

  return (
    <PHProvider client={posthog}>
      {children}
    </PHProvider>
  )
}