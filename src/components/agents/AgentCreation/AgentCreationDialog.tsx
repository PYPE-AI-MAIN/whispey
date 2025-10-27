"use client"

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import CreateAgentFlow from './CreateAgentFlow'
import ConnectAgentFlow from './ConnectAgentFlow'
import AgentChoiceScreen from './AgentChoiceScreen'
import { useFeatureAccess } from '@/app/providers/FeatureAccessProvider'
import { UserPermissionsProvider } from '@/contexts/UserPermissionsContext'

interface AgentCreationDialogProps {
  isOpen: boolean
  onClose: () => void
  onAgentCreated: (agentData: any) => void
  projectId: string
  initialFlow: 'choice' | 'create' | 'connect'
}

type FlowType = 'choice' | 'create' | 'connect'

const AgentCreationDialog: React.FC<AgentCreationDialogProps> = ({ 
  isOpen, 
  onClose, 
  onAgentCreated,
  projectId,
  initialFlow
}) => {
  const [currentFlow, setCurrentFlow] = useState<FlowType>('choice')
  const [loading, setLoading] = useState(false)
  const { canCreatePypeAgent, isLoading: featureLoading } = useFeatureAccess()

  // Reset flow when dialog opens and determine initial flow
  useEffect(() => {
    if (isOpen && !featureLoading) {
      if (initialFlow === 'create' && canCreatePypeAgent) {
        setCurrentFlow('create')
      } else if (initialFlow === 'connect') {
        setCurrentFlow('connect')
      } else {
        // Always show choice screen when initialFlow is 'choice'
        setCurrentFlow('choice')
      }
    }
  }, [isOpen, canCreatePypeAgent, featureLoading, initialFlow])

  const handleClose = () => {
    if (!loading) {
      setCurrentFlow('choice')
      onClose()
    }
  }

  const handleBack = () => {
    if (canCreatePypeAgent) {
      setCurrentFlow('choice')
    } else {
      // For external users, back means close since they don't have a choice screen
      handleClose()
    }
  }

  const handleAgentCreated = (agentData: any) => {
    onAgentCreated(agentData)
    handleClose()
  }

  const renderCurrentFlow = () => {
    // Show loading while checking feature access
    if (featureLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="animate-pulse">
            <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mx-auto mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mx-auto"></div>
          </div>
        </div>
      )
    }

    switch (currentFlow) {
      case 'choice':
        // Only show choice screen for internal users
        if (canCreatePypeAgent) {
          return (
            <AgentChoiceScreen
              onCreateAgent={() => setCurrentFlow('create')}
              onConnectAgent={() => setCurrentFlow('connect')}
              onClose={handleClose}
            />
          )
        }
        // Fallback to connect for external users (shouldn't happen due to useEffect)
        return (
          <ConnectAgentFlow
            projectId={projectId}
            onBack={handleBack}
            onClose={handleClose}
            onAgentCreated={handleAgentCreated}
            onLoadingChange={setLoading}
          />
        )
      case 'create':
        return (
          <CreateAgentFlow
            projectId={projectId}
            onBack={handleBack}
            onClose={handleClose}
            onAgentCreated={handleAgentCreated}
            onLoadingChange={setLoading}
            isPypeAgent={true}
          />
        )
      case 'connect':
        return (
          <ConnectAgentFlow
            projectId={projectId}
            onBack={handleBack}
            onClose={handleClose}
            onAgentCreated={handleAgentCreated}
            onLoadingChange={setLoading}
          />
        )
      default:
        return null
    }
  }

  return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl bg-white dark:bg-gray-900 max-h-[90vh] flex flex-col">
          {renderCurrentFlow()}
        </DialogContent>
      </Dialog>
  )
}

export default AgentCreationDialog