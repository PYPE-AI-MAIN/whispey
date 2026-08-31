'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, XCircle, Loader2 } from 'lucide-react'

type AccountStatus = 'pending' | 'active' | 'declined'

export default function PendingApprovalPage() {
  const { isSignedIn, isLoaded } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()

  const { data, isLoading } = useQuery<{ status: AccountStatus }>({
    queryKey: ['account-status'],
    queryFn: async () => {
      const res = await fetch('/api/me/status')
      if (!res.ok) return { status: 'pending' as AccountStatus }
      return res.json()
    },
    enabled: isLoaded && !!isSignedIn,
    // Poll — the point of this page is waiting for someone else to act
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
  const status = data?.status ?? 'pending'

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }
    if (!isLoading && status === 'active') {
      router.push('/projects')
    }
  }, [isLoaded, isSignedIn, isLoading, status, router])

  if (!isLoaded || isLoading || status === 'active') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {status === 'active' ? "You're approved — redirecting…" : 'Checking your account status…'}
        </p>
      </div>
    )
  }

  const declined = status === 'declined'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 px-6 text-center">
      {declined ? (
        <XCircle className="w-12 h-12 text-red-500 mb-4" />
      ) : (
        <Clock className="w-12 h-12 text-amber-500 mb-4" />
      )}
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
        {declined ? 'Access request declined' : 'Your request is submitted'}
      </h1>
      <p className="text-slate-600 dark:text-slate-400 max-w-md">
        {declined
          ? 'An admin has declined your access request. Contact your workspace admin if you think this is a mistake.'
          : "You'll get an email once an admin approves your account and adds you to an organization."}
      </p>
      <button
        onClick={() => signOut({ redirectUrl: '/sign-in' })}
        className="mt-8 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
      >
        Sign out
      </button>
    </div>
  )
}
