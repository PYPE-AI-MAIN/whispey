"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, CheckCircle, Bot, Phone, PhoneCall, Settings, ArrowRight, Copy, ExternalLink } from 'lucide-react'

interface AgentCreationDialogProps {
  isOpen: boolean
  onClose: () => void
  onAgentCreated: (agentData: any) => void
  projectId: string
}

const AGENT_TYPES = [
  { 
    value: 'inbound', 
    label: 'Inbound',
    description: 'Handle incoming calls',
    icon: Phone,
  },
  { 
    value: 'outbound', 
    label: 'Outbound',
    description: 'Make automated calls',
    icon: PhoneCall,
  },
  { 
    value: 'custom', 
    label: 'Custom',
    description: 'Specialized agent',
    icon: Settings,
  }
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
    agent_type: 'inbound',
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdAgentData, setCreatedAgentData] = useState<any>(null)
  const [copiedId, setCopiedId] = useState(false)

  const selectedAgentType = AGENT_TYPES.find(type => type.value === formData.agent_type)

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
      setCurrentStep('form')
      setFormData({
        name: '',
        agent_type: 'inbound',
        description: ''
      })
      setError(null)
      setCreatedAgentData(null)
      setCopiedId(false)
      onClose()
    }
  }

  const handleFinish = () => {
    onAgentCreated(createdAgentData)
    handleClose()
  }

  const handleCopyId = async () => {
    if (createdAgentData?.id) {
      try {
        await navigator.clipboard.writeText(createdAgentData.id)
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
      } catch (err) {
        console.error('Failed to copy agent ID:', err)
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 rounded-lg border border-gray-200 shadow-xl bg-white">
        {currentStep === 'form' ? (
          <>
            {/* Compact Header */}
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Create Agent
                  </DialogTitle>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Set up your AI agent
                  </p>
                </div>
              </div>
            </DialogHeader>

            {/* Compact Form */}
            <div className="px-6 py-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Agent Name */}
                <div className="space-y-1.5">
                  <label htmlFor="agent-name" className="block text-sm font-medium text-gray-900">
                    Agent Name
                  </label>
                  <Input
                    id="agent-name"
                    placeholder="Customer Support Bot"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={loading}
                    className="h-10 px-3 text-sm border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  />
                </div>

                {/* Compact Agent Type Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900">
                    Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {AGENT_TYPES.map((type) => {
                      const Icon = type.icon
                      const isSelected = formData.agent_type === type.value
                      
                      return (
                        <div
                          key={type.value}
                          className={`relative p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50 shadow-sm' 
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                          onClick={() => setFormData({ ...formData, agent_type: type.value })}
                        >
                          <div className="text-center">
                            <div className={`w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="text-xs font-medium text-gray-900 mb-0.5">{type.label}</div>
                            <div className="text-xs text-gray-500 leading-tight">{type.description}</div>
                          </div>
                          <input
                            type="radio"
                            name="agent_type"
                            value={type.value}
                            checked={isSelected}
                            onChange={() => setFormData({ ...formData, agent_type: type.value })}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={loading}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Compact Description */}
                <div className="space-y-1.5">
                  <label htmlFor="agent-description" className="block text-sm font-medium text-gray-900">
                    Description <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="agent-description"
                    placeholder="Brief description of your agent..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={loading}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none transition-all placeholder:text-gray-500"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}

                {/* Compact Actions */}
                <div className="flex gap-3 pt-3">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 h-10 text-gray-700 border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading || !formData.name.trim()}
                    className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating...
                      </>
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
            {/* Compact Success Header */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center border-b border-gray-100">
              <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <DialogTitle className="text-lg font-semibold text-gray-900 mb-1">
                Agent Created
              </DialogTitle>
              <p className="text-sm text-gray-600">
                "{createdAgentData?.name}" is ready to use
              </p>
            </DialogHeader>

            {/* Compact Success Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Agent Summary */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    {selectedAgentType && <selectedAgentType.icon className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {createdAgentData?.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {selectedAgentType?.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                        Development
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Agent ID */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Agent ID</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                      {createdAgentData?.id?.slice(0, 8)}...
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyId}
                      className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {copiedId && (
                  <p className="text-xs text-green-600 text-right mt-1">
                    Copied to clipboard
                  </p>
                )}
              </div>

              {/* Next Steps - Compact */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 text-sm mb-2">Next Steps</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Configure voice and personality</li>
                  <li>• Set up conversation flows</li>
                  <li>• Test with sample interactions</li>
                </ul>
              </div>

              {/* Compact Actions */}
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 h-10 text-gray-700 border-gray-300 hover:bg-gray-50"
                >
                  Create Another
                </Button>
                <Button 
                  onClick={handleFinish}
                  className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Configure
                  <ArrowRight className="w-4 h-4 ml-1" />
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
