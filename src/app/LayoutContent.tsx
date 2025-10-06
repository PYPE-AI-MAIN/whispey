'use client'

import { SignedIn, SignedOut } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'
import SidebarWrapper from '@/components/shared/SidebarWrapper'
import FeedbackWidget from '@/components/feedback/FeedbackWidget'
import SignOutHandler from '@/components/auth'

// Routes that should never show sidebar (even when signed in)
const noSidebarRoutes = [
  '/',                    // Landing page
  '/sign-in',            // Auth pages
  '/sign-up',
  '/privacy-policy',     // Legal pages
  '/terms-of-service'
]

function shouldShowSidebar(pathname: string): boolean {
  return !noSidebarRoutes.includes(pathname)
}

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = shouldShowSidebar(pathname)

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