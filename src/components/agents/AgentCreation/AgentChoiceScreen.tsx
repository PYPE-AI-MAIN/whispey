"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Sparkles, Eye, Lock, Info, ArrowLeft } from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'
import { useUserPermissions } from '@/contexts/UserPermissionsContext'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Send } from 'lucide-react'

interface AgentChoiceScreenProps {
  onCreateAgent: () => void
  onConnectAgent: () => void
  onClose: () => void
}

const AgentChoiceScreen: React.FC<AgentChoiceScreenProps> = ({
  onCreateAgent,
  onConnectAgent,
  onClose
}) => {
  const { isMobile } = useMobile(768)
  const { canCreatePypeAgent, loading: permissionsLoading } = useUserPermissions()
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmitRequest = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for requesting access')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/request-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'pype_agent_creation',
          reason: reason.trim(),
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send request')
      }

      setSuccess(true)
      setTimeout(() => {
        onClose()
        // Reset state after closing
        setTimeout(() => {
          setReason('')
          setSuccess(false)
          setError(null)
          setShowRequestForm(false)
        }, 300)
      }, 2000)
    } catch (err) {
      setError('Failed to send access request. Please try again.')
      console.error('Error sending access request:', err)
    } finally {
      setLoading(false)
    }
  }

  // Show request form
  if (showRequestForm) {
    return (
      <>
        {/* Header with Back Button */}
        <DialogHeader className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'} flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRequestForm(false)}
              className="h-8 w-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <DialogTitle className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100`}>
                Request Access
              </DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Tell us why you'd like to create agents with Pype
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Request Form Content */}
        <div className={`flex-1 ${isMobile ? 'px-4 py-4' : 'px-6 py-6'} space-y-4`}>
          {success ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                Request Sent Successfully!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We'll review your request and get back to you soon.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Why do you want to create agents with Pype?
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please share your use case, project details, or any specific requirements..."
                  className="min-h-[120px] resize-none"
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {error}
                  </p>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong className="font-medium">Note:</strong> Pype agent creation is currently in beta. 
                  We'll review your request and enable access based on your use case.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex gap-3`}>
            <Button
              variant="outline"
              onClick={() => setShowRequestForm(false)}
              disabled={loading}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={loading || !reason.trim()}
              className="flex-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Request'
              )}
            </Button>
          </div>
        )}
      </>
    )
  }

  // Main choice screen
  return (
    <>
      {/* Header */}
      <DialogHeader className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'} flex-shrink-0`}>
        <div className="text-center">
          <div className={`${isMobile ? 'w-10 h-10 mb-2' : 'w-12 h-12 mb-3'} mx-auto bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-800`}>
            <Sparkles className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-gray-700 dark:text-gray-300`} />
          </div>
          <DialogTitle className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100 mb-1`}>
            Setup Voice Agent
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose how you'd like to get started
          </p>
        </div>
      </DialogHeader>

      {/* Content */}
      <div className={`flex-1 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
        <div className="space-y-3">
          {/* Loading state */}
          {permissionsLoading ? (
            <>
              <div className={`${isMobile ? 'p-4' : 'p-6'} rounded-xl border-2 border-gray-200 dark:border-gray-700`}>
                <div className="flex items-start gap-3">
                  <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse`}></div>
                  <div className="flex-1">
                    <div className={`${isMobile ? 'h-4 w-32' : 'h-5 w-40'} bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2`}></div>
                    <div className={`${isMobile ? 'h-3 w-48' : 'h-4 w-64'} bg-gray-200 dark:bg-gray-700 rounded animate-pulse`}></div>
                  </div>
                </div>
              </div>
              <div className={`${isMobile ? 'p-4' : 'p-6'} rounded-xl border-2 border-gray-200 dark:border-gray-700`}>
                <div className="flex items-start gap-3">
                  <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse`}></div>
                  <div className="flex-1">
                    <div className={`${isMobile ? 'h-4 w-32' : 'h-5 w-40'} bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2`}></div>
                    <div className={`${isMobile ? 'h-3 w-48' : 'h-4 w-64'} bg-gray-200 dark:bg-gray-700 rounded animate-pulse`}></div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Create Agent Option */}
              <div
                className={`group relative ${isMobile ? 'p-4' : 'p-6'} rounded-xl border-2 ${
                  canCreatePypeAgent 
                    ? 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/70'
                } transition-all duration-200 cursor-pointer`}
                onClick={canCreatePypeAgent ? onCreateAgent : () => setShowRequestForm(true)}
              >
                <div className="flex items-start gap-3">
                  <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} ${
                    canCreatePypeAgent
                      ? 'bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50'
                      : 'bg-gray-100 dark:bg-gray-800'
                  } rounded-xl flex items-center justify-center flex-shrink-0 transition-colors`}>
                    {canCreatePypeAgent ? (
                      <Plus className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-blue-600 dark:text-blue-400`} />
                    ) : (
                      <Lock className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-gray-400 dark:text-gray-500`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`flex items-center gap-2 ${isMobile ? 'mb-1' : 'mb-2'}`}>
                      <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold ${
                        canCreatePypeAgent 
                          ? 'text-gray-900 dark:text-gray-100' 
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {isMobile ? 'Create Pype Agent' : 'Create New Agent with Pype'}
                      </h3>
                      {!canCreatePypeAgent && (
                        <span className="text-xs font-medium px-2 py-0.5 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                          Beta
                        </span>
                      )}
                    </div>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} ${
                      canCreatePypeAgent
                        ? 'text-gray-600 dark:text-gray-400'
                        : 'text-gray-500 dark:text-gray-500'
                    } leading-relaxed`}>
                      {canCreatePypeAgent ? (
                        isMobile 
                          ? 'Build a new voice agent from scratch with automatic monitoring setup.'
                          : 'Build a new voice agent from scratch. We\'ll create the assistant and set up monitoring automatically.'
                      ) : (
                        <span className="font-medium">
                          Want access to create agents with Pype? <span className="text-blue-500 dark:text-blue-400">Get in touch →</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Connect Agent Option */}
              <div
                className={`group relative ${isMobile ? 'p-4' : 'p-6'} rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all duration-200 cursor-pointer`}
                onClick={onConnectAgent}
              >
                <div className="flex items-start gap-3">
                  <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-teal-100 dark:bg-teal-900/30 group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors`}>
                    <Eye className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-teal-600 dark:text-teal-400`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`${isMobile ? 'text-base mb-1' : 'text-lg mb-2'} font-semibold text-gray-900 dark:text-gray-100`}>
                      Connect Existing Agent
                    </h3>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400 leading-relaxed`}>
                      {isMobile
                        ? 'Add monitoring to your existing LiveKit or Vapi voice agent.'
                        : 'Add monitoring to your existing LiveKit or Vapi voice agent. Connect and start observing immediately.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`flex-shrink-0 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'} bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800`}>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={onClose}
            size={isMobile ? "sm" : "default"}
            className={`flex-1 ${isMobile ? 'h-9 text-sm' : 'h-10'} text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`}
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  )
}

export default AgentChoiceScreen