'use client'

import { useUser } from '@clerk/nextjs'
import ProjectSelection from '../components/ProjectSelection'
import LoadingSpinner from '../components/LoadingSpinner'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign') // This ensures your custom page is used
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded) return <LoadingSpinner />
  if (!isSignedIn) return <LoadingSpinner />

  return <ProjectSelection />
}