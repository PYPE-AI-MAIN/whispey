'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function DashboardRedirect() {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useUser()

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        router.replace('/projects')
      } else {
        router.replace('/sign-in')
      }
    }
  }, [isLoaded, isSignedIn, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center">
        <div className="text-slate-600 dark:text-slate-400 mb-2">Redirecting...</div>
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
}