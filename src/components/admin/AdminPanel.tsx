'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft,
  AlertCircle,
  BarChart3,
  Settings as SettingsIcon,
  Users,
  Clock,
  Database,
  TrendingUp,
  Shield,
  Activity
} from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'
import ErrorMonitoring from './sections/ErrorMonitoring'
import AnalyticsDashboard from './sections/AnalyticsDashboard'
import SessionManagement from './sections/SessionManagement'
import CustomerTracking from './sections/CustomerTracking'
import DataManagement from './sections/DataManagement'

interface AdminPanelProps {
  projectId: string
}

type AdminSection = 
  | 'error-monitoring' 
  | 'analytics' 
  | 'sessions' 
  | 'customers' 
  | 'data-management'

const AdminPanel: React.FC<AdminPanelProps> = ({ projectId }) => {
  const router = useRouter()
  const { isMobile } = useMobile(768)
  const [activeSection, setActiveSection] = useState<AdminSection>('error-monitoring')

  const sections = [
    {
      id: 'error-monitoring' as AdminSection,
      name: 'Error Monitoring',
      icon: AlertCircle,
      description: 'Real-time error tracking and monitoring',
      available: true
    },
    {
      id: 'analytics' as AdminSection,
      name: 'Analytics',
      icon: BarChart3,
      description: 'Advanced analytics and insights',
      available: true
    },
    {
      id: 'sessions' as AdminSection,
      name: 'Session Management',
      icon: Clock,
      description: 'Track and manage error sessions',
      available: true
    },
    {
      id: 'customers' as AdminSection,
      name: 'Customer Tracking',
      icon: Users,
      description: 'Monitor errors by customer',
      available: true
    },
    {
      id: 'data-management' as AdminSection,
      name: 'Data Management',
      icon: Database,
      description: 'Cleanup and manage error data',
      available: true
    }
  ]

  const handleBack = () => {
    router.push(`/${projectId}/agents`)
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'error-monitoring':
        return <ErrorMonitoring projectId={projectId} />
      case 'analytics':
        return <AnalyticsDashboard projectId={projectId} />
      case 'sessions':
        return <SessionManagement projectId={projectId} />
      case 'customers':
        return <CustomerTracking projectId={projectId} />
      case 'data-management':
        return <DataManagement projectId={projectId} />
      default:
        return <ErrorMonitoring projectId={projectId} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
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
                  Admin Panel
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Professional error monitoring and management system
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                    ${isActive 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-800 shadow-sm' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {section.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderSection()}
      </div>
    </div>
  )
}

export default AdminPanel
