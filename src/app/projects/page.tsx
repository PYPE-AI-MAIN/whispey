'use client'

import { useUser } from '@clerk/nextjs'
import ProjectSelection from '../../components/projects/ProjectSelection'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProjectsPage() {
  const { isSignedIn, isLoaded, user } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  // 🔍 Debug log for specific user only

  console.log({user})
  useEffect(() => {
    if (user?.emailAddresses[0]?.emailAddress === 'soma2tatin3@gmail.com') {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔑 CLERK ID:', user.id)
      console.log('📧 EMAIL:', user.emailAddresses[0]?.emailAddress)
      console.log('👤 NAME:', user.firstName, user.lastName)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
  }, [user])

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    return null
  }

  return <ProjectSelection isAuthLoaded={isLoaded} />
}