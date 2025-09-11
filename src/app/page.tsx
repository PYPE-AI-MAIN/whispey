'use client'

import { useUser } from '@clerk/nextjs'
import ProjectSelection from '../components/projects/ProjectSelection'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Header from '../components/shared/Header'


export default function Home() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign')
    }
  }, [isLoaded, isSignedIn, router])


  return (
    <div>
    <Header />
    <ProjectSelection isAuthLoaded={isLoaded} />
    </div>
  )
}