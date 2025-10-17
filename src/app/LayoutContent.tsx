'use client'

import { SignedIn, SignedOut, useUser } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import SidebarWrapper from '@/components/shared/SidebarWrapper'
import FeedbackWidget from '@/components/feedback/FeedbackWidget'
import SignOutHandler from '@/components/auth'

// Routes that should never show sidebar (even when signed in)
const noSidebarRoutes = [
  '/',
  '/sign-in',
  '/sign-up',
  '/privacy-policy',
  '/terms-of-service',
  '/onboarding'  // ✅ ADD THIS
]

function shouldShowSidebar(pathname: string): boolean {
  return !noSidebarRoutes.includes(pathname)
}

function useIntelligentClerkSync() {
  const { isLoaded, isSignedIn } = useUser()
  const syncAttempted = useRef(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || syncAttempted.current) return

    const checkAndSync = async () => {
      try {
        const userCheckResponse = await fetch('/api/user/users')
        
        if (userCheckResponse.ok) {
          return
        }

        const userCheckData = await userCheckResponse.json()
        
        if (userCheckResponse.status === 404 && userCheckData.error === 'User not found') {
          console.log('🔍 User not found with current Clerk ID, attempting sync...')
          
          const syncResponse = await fetch('/api/admin/sync-clerk-id', {
            method: 'POST',
          })
          
          if (syncResponse.ok) {
            const syncData = await syncResponse.json()
            if (syncData.synced) {
              console.log('✅ Clerk ID automatically synced')
            } else {
              console.log('ℹ️ Sync not needed:', syncData.reason)
            }
          }
        }
      } catch (error) {
        console.error('Background sync check error:', error)
      } finally {
        syncAttempted.current = true
      }
    }

    checkAndSync()
  }, [isLoaded, isSignedIn])
}

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = shouldShowSidebar(pathname)

  useIntelligentClerkSync()

  return (
    <main>
      <SignedOut>
        <div className="min-h-screen">
          {children}
        </div>
      </SignedOut>
      <SignedIn>
        <SignOutHandler>
          {showSidebar ? (
            <SidebarWrapper>
              {children}
            </SidebarWrapper>
          ) : (
            <div className="min-h-screen">
              {children}
            </div>
          )}
          <FeedbackWidget />
        </SignOutHandler>
      </SignedIn>
    </main>
  )
}