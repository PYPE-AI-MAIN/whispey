"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle } from 'lucide-react'

interface AgentCreationDialogProps {
  isOpen: boolean
  onClose: () => void
  onAgentCreated: (agentData: any) => void
  projectId: string
}

const AGENT_TYPES = [
  { value: 'voice_assistant', label: 'Voice Assistant' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'sales_agent', label: 'Sales Agent' },
  { value: 'support_agent', label: 'Support Agent' },
  { value: 'custom', label: 'Custom Agent' }
]

const AgentCreationDialog: React.FC<AgentCreationDialogProps> = ({ 
  isOpen, 
  onClose, 
  onAgentCreated,
  projectId
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'success'>('form')
  const [formData, setFormData] = useState({
    name: '',
    agent_type: 'voice_assistant',
    description: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdAgentData, setCreatedAgentData] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Agent name is required')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          agent_type: formData.agent_type,
          configuration: {
            description: formData.description.trim() || null,
          },
          project_id: projectId,
          environment: 'dev'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create agent')
      }

      const data = await response.json()
      setCreatedAgentData(data)
      setCurrentStep('success')
      
    } catch (err: unknown) {
      console.error('Error creating agent:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create agent'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      // Reset all state
      setCurrentStep('form')
      setFormData({
        name: '',
        agent_type: 'voice_assistant',
        description: ''
      })
      setError(null)
      setCreatedAgentData(null)
      onClose()
    }
  }

  const handleFinish = () => {
    // Call success callback with the created agent
    onAgentCreated(createdAgentData)
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 rounded-xl border shadow-2xl">
        {currentStep === 'form' ? (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center">
              <DialogTitle className="text-xl font-semibold text-gray-900 mb-1">
                Create New Agent
              </DialogTitle>
              <p className="text-sm text-gray-600 font-normal">
                Set up your AI agent for this project
              </p>
            </DialogHeader>

            {/* Form */}
            <div className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Agent Name */}
                <div>
                  <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Name
                  </label>
                  <Input
                    id="agent-name"
                    placeholder="Enter agent name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={loading}
                    className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>

                {/* Agent Type */}
                <div>
                  <label htmlFor="agent-type" className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Type
                  </label>
                  <select
                    id="agent-type"
                    value={formData.agent_type}
                    onChange={(e) => setFormData({ ...formData, agent_type: e.target.value })}
                    disabled={loading}
                    className="w-full h-11 px-4 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all bg-white"
                  >
                    {AGENT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="agent-description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <textarea
                    id="agent-description"
                    placeholder="Brief description of your agent..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={loading}
                    rows={3}
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none resize-none transition-all placeholder:text-gray-400"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <span className="text-sm text-red-700 font-medium">{error}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 h-11 font-medium text-gray-700 border-gray-300 hover:bg-gray-50 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading || !formData.name.trim()}
                    className="flex-1 h-11 text-white rounded-lg font-medium shadow-sm disabled:bg-gray-300 disabled:text-gray-500 transition-all"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Create Agent'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <>
            {/* Success Header */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-gray-900 mb-1">
                Agent Created Successfully!
              </DialogTitle>
              <p className="text-sm text-gray-600 font-normal">
                Your agent "{createdAgentData?.name}" has been created
              </p>
            </DialogHeader>

            {/* Success Content */}
            <div className="px-6 pb-6 space-y-4">
              {/* Agent Details */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 text-sm mb-2">Agent Details</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Agent ID:</span>
                    <span className="font-mono text-gray-800">{createdAgentData?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="text-gray-800 capitalize">{createdAgentData?.agent_type?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Environment:</span>
                    <span className="text-gray-800">{createdAgentData?.environment}</span>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> API tokens are managed at the project level. 
                  Use your project's API token to authenticate requests for this agent.
                </p>
              </div>

              {/* Finish Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleFinish}
                  className="w-full h-11 text-white rounded-lg font-medium shadow-sm"
                >
                  Continue to Agent
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AgentCreationDialog 