'use client'

import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

function Header() {
    const { isSignedIn, isLoaded } = useUser()
    const router = useRouter()
    const [organizations, setOrganizations] = useState<any[]>([])
    const [orgsLoading, setOrgsLoading] = useState(false)

    // Fetch organizations when user is signed in
    useEffect(() => {
      if (isSignedIn && isLoaded) {
        fetchOrganizations()
      }
    }, [isSignedIn, isLoaded])

    const fetchOrganizations = async () => {
      setOrgsLoading(true)
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          setOrganizations(data)
        }
      } catch (err) {
        console.error('Failed to fetch organizations:', err)
      } finally {
        setOrgsLoading(false)
      }
    }

    const handleGetStarted = async () => {
      if (!isLoaded) return
      
      if (isSignedIn) {        
        if (typeof window !== 'undefined') {
          const lastVisitedOrgId = localStorage.getItem('whispey-last-org')
          
          let orgsToCheck = organizations
          if (orgsToCheck.length === 0 && !orgsLoading) {
            try {
              const res = await fetch('/api/projects')
              if (res.ok) {
                orgsToCheck = await res.json()
              }
            } catch (err) {
              console.error('Failed to fetch organizations:', err)
            }
          }
          
          // Check if last visited org exists in current orgs list
          const lastVisitedOrg = orgsToCheck.find((org: any) => org.id === lastVisitedOrgId)
          
          if (lastVisitedOrg) {
            router.push(`/${lastVisitedOrgId}/agents`)
          } else if (orgsToCheck.length > 0) {
            // Navigate to first org
            const firstOrgId = orgsToCheck[0].id
            localStorage.setItem('whispey-last-org', firstOrgId)
            router.push(`/${firstOrgId}/agents`)
          } else {
            // No orgs available, go to projects page
            router.push('/projects')
          }
        }
      } else {
        router.push('/sign-in')
      }
    }

    // Determine button text
    const getButtonText = () => {
      if (!isLoaded || orgsLoading) return 'Loading...'
      if (!isSignedIn) return 'Sign in'
      
      if (organizations.length > 0) {
        return 'Go to Dashboard'
      }
      return 'Go to Projects'
    }

  return (
    <header className="wl-header sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Brand />
        <nav aria-label="Main" className="hidden items-center gap-8 text-sm md:flex">
          <Link href="#features" className="wl-link">Features</Link>
          <Link href="#how-it-works" className="wl-link">How it works</Link>
          <a href="https://docs.whispey.pypeai.com" target="_blank" rel="noopener noreferrer" className="wl-link">Docs</a>
        </nav>
        <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          type="button"
          className="wl-btn wl-btn-sm"
          onClick={handleGetStarted}
          disabled={!isLoaded || orgsLoading}
        >
          {getButtonText()}
        </button>
        </div>
      </div>
    </header>
  )
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/20 hover:bg-black/5 dark:hover:bg-white/10"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <a href="https://pypeai.com/" target="_blank" rel="noopener noreferrer" aria-label="Pype AI" className="rounded-md">
        <Image src="/logo-light.png" alt="" width={30} height={30} priority unoptimized className="dark:hidden" style={{ objectFit: 'contain' }} />
        <Image src="/logo-dark.png" alt="" width={30} height={30} priority unoptimized className="hidden dark:block" style={{ objectFit: 'contain' }} />
      </a>
      <div className="flex flex-col gap-1.5">
        <span className="text-[17px] font-semibold leading-none">Whispey</span>
        <span className="wl-muted flex items-center gap-1.5 self-end">
          <span className="text-[10px] font-semibold">by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pype-wordmark.png" alt="Pype" style={{ height: '9px', width: 'auto' }} />
        </span>
      </div>
    </div>
  )
}

export default Header
