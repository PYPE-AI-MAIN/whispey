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
  '/onboarding'
]

function shouldShowSidebar(pathname: string): boolean {
  // Hide sidebar for playground pages
  if (pathname.includes('/playground')) {
    return false
  }
  return !noSidebarRoutes.includes(pathname)
}

function useIntelligentClerkSync() {
  const { isLoaded, isSignedIn } = useUser()
  const pathname = usePathname()
  const syncAttempted = useRef(false)

  useEffect(() => {
    // Skip sync for playground routes (they're public)
    if (pathname?.includes('/playground')) return
    
    if (!isLoaded || !isSignedIn || syncAttempted.current) return

    const checkAndSync = async () => {
      try {
        const userCheckResponse = await fetch('/api/user/users')
        
        if (userCheckResponse.ok) {
          return
        }

        const userCheckData = await userCheckResponse.json()
        
        if (userCheckResponse.status === 404 && userCheckData.error === 'User not found') {
          console.log('🔍 User not found, trying sync or create...')
          
          // Try sync first (for whitelisted migrated users)
          const syncResponse = await fetch('/api/admin/sync-clerk-id', {
            method: 'POST',
          })
          
          if (syncResponse.ok) {
            const syncData = await syncResponse.json()
            if (syncData.synced) {
              console.log('✅ User synced')
              return
            }
          }

          // If sync didn't work, create new user
          const createResponse = await fetch('/api/user/create', {
            method: 'POST',
          })
          
          if (createResponse.ok) {
            console.log('✅ User created')
          }
        }
      } catch (error) {
        console.error('Sync error:', error)
      } finally {
        syncAttempted.current = true
      }
    }

    checkAndSync()
  }, [isLoaded, isSignedIn, pathname])
}

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = shouldShowSidebar(pathname)
  const isPlayground = pathname.includes('/playground')

  // Always call hook (required by React), but it will skip for playground routes
  useIntelligentClerkSync()

  // Playground routes are completely public - bypass all auth checks
  if (isPlayground) {
    return (
      <main>
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    )
  }

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