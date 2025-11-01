// src/app/unauthorized/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

export default function UnauthorizedPage() {
  const router = useRouter()

  // Prevent React Query from trying to fetch project data
  useEffect(() => {
    // Clear any project-related query cache
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('currentProjectId')
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Access Denied
        </h1>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          You don't have permission to access this page. Please contact your organization admin to request access.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </Button>
        </div>

        {/* Additional Help */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Need help?</strong> If you believe this is an error, please contact support at{' '}
            <a href="mailto:suryadipta@pypeai.com" className="text-blue-600 dark:text-blue-400 hover:underline">
              suryadipta@pypeai.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}