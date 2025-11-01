// src/app/LayoutContent.tsx

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
  '/onboarding',
  '/unauthorized',
]

function shouldShowSidebar(pathname: string): boolean {
  // Check exact matches - if any match, don't show sidebar
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
          console.log('✅ User exists in database')
          return
        }

        const userCheckData = await userCheckResponse.json()
        
        if (userCheckResponse.status === 404 && userCheckData.error === 'User not found') {
          console.log('🔍 User not found, checking migration/creation...')
          
          // First try sync (for migrated users with whitelisted emails)
          const syncResponse = await fetch('/api/admin/sync-clerk-id', {
            method: 'POST',
          })
          
          if (syncResponse.ok) {
            const syncData = await syncResponse.json()
            if (syncData.synced) {
              console.log('✅ Migrated user - Clerk ID synced')
              return
            }
            console.log('ℹ️ Sync skipped:', syncData.reason)
          }

          // If sync didn't work, create new user
          const createResponse = await fetch('/api/user/create', {
            method: 'POST',
          })
          
          if (createResponse.ok) {
            const createData = await createResponse.json()
            
            if (createData.alreadyExists) {
              console.log('ℹ️ User already exists:', createData.userId)
            } else {
              console.log('✅ New user created:', createData.user.email)
              if (createData.claimedInvitations > 0) {
                console.log(`📨 Claimed ${createData.claimedInvitations} project invitation(s)`)
              }
            }
          } else {
            const errorData = await createResponse.json()
            console.error('❌ Failed to create user:', errorData.error)
          }
        }
      } catch (error) {
        console.error('❌ Background sync error:', error)
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