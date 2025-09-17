"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import CreateAgentFlow from './CreateAgentFlow'
import ConnectAgentFlow from './ConnectAgentFlow'
import AgentChoiceScreen from './AgentChoiceScreen'

interface AgentCreationDialogProps {
  isOpen: boolean
  onClose: () => void
  onAgentCreated: (agentData: any) => void
  projectId: string
}

type FlowType = 'choice' | 'create' | 'connect'

const AgentCreationDialog: React.FC<AgentCreationDialogProps> = ({ 
  isOpen, 
  onClose, 
  onAgentCreated,
  projectId
}) => {
  const [currentFlow, setCurrentFlow] = useState<FlowType>('choice')
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    if (!loading) {
      setCurrentFlow('choice')
      onClose()
    }
  }

  const handleBack = () => {
    setCurrentFlow('choice')
  }

  const handleAgentCreated = (agentData: any) => {
    onAgentCreated(agentData)
    handleClose()
  }

  const renderCurrentFlow = () => {
    switch (currentFlow) {
      case 'choice':
        return (
          <AgentChoiceScreen
            onCreateAgent={() => setCurrentFlow('create')}
            onConnectAgent={() => setCurrentFlow('connect')}
            onClose={handleClose}
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