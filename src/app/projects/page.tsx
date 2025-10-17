// src/app/projects/page.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

const fetchOrganizations = async () => {
  const response = await fetch('/api/projects')
  if (!response.ok) throw new Error('Failed to fetch organizations')
  return response.json()
}

export default function ProjectsPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  const { data: organizations, isLoading: loadingOrgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    enabled: isSignedIn && isLoaded,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }

    if (organizations && !isRedirecting) {
      setIsRedirecting(true)
      
      // If no organizations exist, redirect to onboarding
      if (organizations.length === 0) {
        router.push('/onboarding')
        return
      }

      // Try to get last visited org from localStorage
      let targetOrgId = null
      if (typeof window !== 'undefined') {
        const lastVisitedOrgId = localStorage.getItem('whispey-last-org')
        const lastVisitedOrg = organizations.find((org: any) => org.id === lastVisitedOrgId)
        
        if (lastVisitedOrg) {
          targetOrgId = lastVisitedOrg.id
        }
      }
      
      // If no last visited org, use the first one
      if (!targetOrgId) {
        targetOrgId = organizations[0].id
      }
      
      // Redirect to the organization's agents page
      router.push(`/${targetOrgId}/agents`)
    }
  }, [isLoaded, isSignedIn, organizations, router, isRedirecting])

  // Show loading state
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {!isLoaded ? 'Loading...' : isRedirecting ? 'Redirecting...' : 'Loading organizations...'}
      </p>
    </div>
  )
}