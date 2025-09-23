'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

interface SignOutHandlerProps {
  children: React.ReactNode
}

export default function SignOutHandler({ children }: SignOutHandlerProps) {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoaded && !isSignedIn && !pathname.startsWith('/sign-in') && !pathname.startsWith('/sign-up')) {
      router.replace('/sign-in')
    }
  }, [isLoaded, isSignedIn, pathname, router])


  if (isLoaded && !isSignedIn && !pathname.startsWith('/sign-in') && !pathname.startsWith('/sign-up')) {
    return null
  }

  return <>{children}</>
}