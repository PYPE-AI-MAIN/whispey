'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function CallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    const redirect = searchParams.get('redirect')

    if (!token || !redirect) {
      setError('Missing token or redirect URL')
      return
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/validate-sso-token?token=${token}`)
        const data = await res.json()

        if (res.ok && data.valid) {
          // Token valid, redirect
          router.replace(redirect)
        } else {
          setError(data.detail || 'Invalid token')
        }
      } catch (err) {
        setError('Something went wrong while validating the token')
      }
    }

    validateToken()
  }, [searchParams, router])

  if (error) {
    return <div style={{ padding: '2rem', color: 'red' }}>SSO Error: {error}</div>
  }

  return <div style={{ padding: '2rem' }}>Validating, please wait...</div>
}