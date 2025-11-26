'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Shield } from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'
import ErrorMonitoring from './sections/ErrorMonitoring'

interface AdminPanelProps {
  projectId: string
}

const AdminPanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const router = useRouter()
  const { isMobile } = useMobile(768)

  const handleBack = () => {
    router.push(`/${projectId}/agents`)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              {!isMobile && 'Back'}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Error Monitoring
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Real-time error tracking and insights across all agents
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorMonitoring projectId={projectId} />
      </div>
    </div>
  )
}

export default AdminPanel
