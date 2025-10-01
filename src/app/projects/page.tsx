'use client'

import { useUser } from '@clerk/nextjs'
import ProjectSelection from '../../components/projects/ProjectSelection'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProjectsPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    return null // Redirect will handle this
  }

  return <ProjectSelection isAuthLoaded={isLoaded} />
}