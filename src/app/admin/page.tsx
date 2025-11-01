// src/app/admin/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Loader2, Building2, ArrowRight, Shield } from 'lucide-react'
import Link from 'next/link'

export default function AdminPage() {
  const router = useRouter()
  const { user: clerkUser, isLoaded } = useUser()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAccess = async () => {
      if (!isLoaded) return
      
      if (!clerkUser?.id) {
        router.push('/unauthorized')
        return
      }

      try {
        // ✅ Use new check-access endpoint
        const response = await fetch('/api/user/check-access')
        
        if (!response.ok) {
          setIsAuthorized(false)
          router.push('/unauthorized')
          return
        }
        
        const result = await response.json()
        
        if (result.isSuperAdmin) {
          setIsAuthorized(true)
        } else {
          setIsAuthorized(false)
          router.push('/unauthorized')
        }
      } catch (error) {
        console.error('Error checking access:', error)
        setIsAuthorized(false)
        router.push('/unauthorized')
      }
    }

    checkAccess()
  }, [clerkUser, isLoaded, router])

  if (isAuthorized === null || !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (isAuthorized === false) {
    return null
  }

  // ✅ Only show Project Management card
  const adminCards = [
    {
      id: 'projects',
      title: 'Project Management',
      description: 'Manage projects, plans, agent limits, and member permissions',
      icon: Building2,
      path: '/admin/projects',
      color: 'blue'
    }
  ]

  const getColorClasses = (color: string) => {
    return {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      icon: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      hover: 'hover:border-blue-300 dark:hover:border-blue-700'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Admin Panel
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Platform administration and management
              </p>
            </div>
          </div>
        </div>

        {/* Admin Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminCards.map((card) => {
            const colors = getColorClasses(card.color)
            const Icon = card.icon

            return (
              <Link 
                key={card.id}
                href={card.path}
                className="group"
              >
                <div className={`
                  bg-white dark:bg-gray-900 
                  border-2 ${colors.border} ${colors.hover}
                  rounded-xl p-6 
                  transition-all duration-200
                  hover:shadow-lg
                  cursor-pointer
                `}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`
                      w-12 h-12 rounded-lg ${colors.bg}
                      flex items-center justify-center
                      transition-transform duration-200
                      group-hover:scale-110
                    `}>
                      <Icon className={`w-6 h-6 ${colors.icon}`} />
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </div>

                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {card.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
                Superadmin Access
              </h4>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                You have full administrative access to the platform. Use these tools carefully as changes can affect all users and projects.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}