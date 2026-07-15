'use client'

import { ArrowRight } from 'lucide-react';
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { Button } from '../ui/button';
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
      if (!isSignedIn) return 'Get Started'
      
      if (organizations.length > 0) {
        return 'Go to Dashboard'
      }
      return 'Go to Projects'
    }

  return (
    <header className="border-b border-border/40 sticky top-0 z-50 overflow-hidden">
      {/* Liquid Glass Effect Layer */}
      <div className="absolute inset-0 bg-background/75 backdrop-blur-md" />
      
      {/* Enhanced glass morphism with edge effects */}
      <div className="absolute inset-0">
        {/* Main glass surface */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-white/[0.02] dark:from-white/[0.02] dark:via-transparent dark:to-white/[0.01]" />
        
        {/* Subtle edge highlight - top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        {/* Edge glow effects */}
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-blue-400/8 to-transparent" />
        
        {/* Bottom border enhancement */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-between items-center py-4">
            {/* Left side - Logo with enhanced effects */}
            <div className="flex items-center space-x-3">
              <a href="https://pypeai.com/" target="_blank" rel="noopener noreferrer" className="relative group" style={{ width: '30px', height: '30px' }}>
                {/* Enhanced glow effect on hover */}
                <div className="absolute inset-0 rounded-xl bg-blue-500/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <Image src="/logo-light.png" alt="Pype Logo" width={30} height={30} style={{ objectFit: 'contain' }} className="dark:hidden" />
                  <Image src="/logo-dark.png" alt="Pype Logo" width={30} height={30} style={{ objectFit: 'contain' }} className="hidden dark:block" />
                </div>
              </a>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', height: '32px', justifyContent: 'space-between' }}>
                <span
                  className="text-[#111827] dark:text-[#F3F4F6]"
                  style={{ fontSize: '17px', fontWeight: 600, lineHeight: 1, fontFamily: '-apple-system, "Segoe UI", sans-serif', alignSelf: 'flex-start' }}
                >
                  Whispey
                </span>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '5px' }}>
                  <span
                    className="text-[#6D28D9] dark:text-[#8B7BC9]"
                    style={{ fontSize: '10px', fontWeight: 600, fontFamily: '-apple-system, "Segoe UI", sans-serif' }}
                  >
                    by
                  </span>
                  <img src="/pype-wordmark.png" alt="Pype" style={{ height: '9px', width: 'auto', objectFit: 'contain' }} />
                </div>
              </div>
            </div>

            {/* Center - Enhanced Navigation */}
            <nav className="hidden md:flex items-center space-x-6 absolute left-1/2 -translate-x-1/2">
              <Link href="#features" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors relative group">
                Features
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 group-hover:w-full transition-all duration-300" />
              </Link>
              <Link href="#how-it-works" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors relative group">
                How it Works
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 group-hover:w-full transition-all duration-300" />
              </Link>
              <Link 
                href="/docs" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors relative group"
              >
                Docs
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 group-hover:w-full transition-all duration-300" />
              </Link>
            </nav>

            {/* Right side - GitHub, Discord + Auth buttons */}
            <div className="flex items-center space-x-3">
              <div className="w-px h-6 bg-border/40 mx-2" />
              
              <Button 
                size="sm" 
                className="hidden sm:inline-flex group relative overflow-hidden font-medium bg-white dark:bg-gray-900 text-gray-900 dark:text-white cursor-pointer border-0 shadow-lg shadow-blue-600/25 dark:shadow-blue-400/20 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={handleGetStarted}
                disabled={!isLoaded || orgsLoading}
              >
                <span className="relative z-10">
                  {getButtonText()}
                </span>
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform relative z-10" />
                {/* Enhanced shimmer effect with dark mode support */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header