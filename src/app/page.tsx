// src/app/page.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import ProjectSelection from '../components/projects/ProjectSelection'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  return <ProjectSelection isAuthLoaded={isLoaded} />
}