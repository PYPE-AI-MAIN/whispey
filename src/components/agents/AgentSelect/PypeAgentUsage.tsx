// src/components/agents/AgentSelect/PypeAgentUsage.tsx

import React, { useState } from 'react'
import { Info, Plus, Lock, Send, Loader2 } from 'lucide-react'
import { useUserPermissions } from '@/contexts/UserPermissionsContext'
import { useFeatureAccess } from '@/app/providers/FeatureAccessProvider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMobile } from '@/hooks/use-mobile'
import type { EmailNotificationRequest, EmailNotificationResponse } from '@/types/email-notifications'

interface PypeAgentUsageProps {
  projectId: string
  onCreateAgent: () => void
}

const PypeAgentUsage: React.FC<PypeAgentUsageProps> = ({ projectId, onCreateAgent }) => {
  const { permissions, userProjectPermissions, loading } = useUserPermissions({ projectId })
  const { isSuperAdmin } = useFeatureAccess()
  const { isMobile } = useMobile(768)
  
  // Request access dialog state
  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [reason, setReason] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // ✅ Check if user has explicit permission to create agents
  const hasCreatePermission = userProjectPermissions?.can_create_agents === true

  // ✅ Check project plan (FREE projects can't create agents)
  const projectPlan = permissions?.plans?.type
  const projectIsFree = projectPlan === 'FREE' || projectPlan === 'USER'
  const projectAllowsAgentCreation = !projectIsFree && ['BETA', 'PAID', 'SUPERADMIN'].includes(projectPlan || '')

  // ✅ Get agent data with safe defaults
  const activeCount = permissions?.agent?.usage?.active_count ?? 0
  const maxAgents = permissions?.agent?.limits?.max_agents ?? 0
  const agentsList = permissions?.agent?.agents || []
  
  // ✅ Check if we have valid project setup for agents
  const hasValidAgentSetup = projectAllowsAgentCreation && maxAgents > 0
  
  const hasReachedLimit = hasValidAgentSetup && activeCount >= maxAgents
  const remainingSlots = Math.max(0, maxAgents - activeCount)
  const usagePercentage = maxAgents > 0 ? (activeCount / maxAgents) * 100 : 0

  // ✅ User can create if: SUPERADMIN OR has explicit permission
  const userCanCreate = isSuperAdmin || hasCreatePermission

  // ✅ Button is disabled ONLY when user can create but reached limit
  const isCreateButtonDisabled = userCanCreate && projectAllowsAgentCreation && hasReachedLimit

  // ✅ Show request dialog if: user CANNOT create OR project doesn't allow
  const shouldShowRequestDialog = !userCanCreate || !projectAllowsAgentCreation

  // Debug logging
  console.log('🔍 PypeAgentUsage Debug:', {
    projectId,
    projectPlan,
    projectIsFree,
    projectAllowsAgentCreation,
    hasValidAgentSetup,
    isSuperAdmin,
    hasCreatePermission,
    userCanCreate,
    hasReachedLimit,
    isCreateButtonDisabled,
    shouldShowRequestDialog,
    activeCount,
    maxAgents,
    userProjectPermissions
  })

  const handleSubmitRequest = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for requesting access')
      return
    }

    setRequestLoading(true)
    setError(null)

    try {
      const requestBody: EmailNotificationRequest = {
        type: 'agent_permission',
        description: `${reason.trim()}\n\nProject ID: ${projectId}\nCurrent max_agents: ${maxAgents}`
      }

      const response = await fetch('/api/email/notify-admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send request' }))
        throw new Error(errorData.error || 'Failed to send request')
      }

      const data: EmailNotificationResponse = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to send request')
      }

      setSuccess(true)
      setTimeout(() => {
        setShowRequestDialog(false)
        setTimeout(() => {
          setReason('')
          setSuccess(false)
          setError(null)
        }, 300)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send access request. Please try again.')
      console.error('Error sending access request:', err)
    } finally {
      setRequestLoading(false)
    }
  }

  const handleCreateAgentClick = () => {
    console.log('🎯 Create Agent Click:', {
      shouldShowRequestDialog,
      isCreateButtonDisabled,
      userCanCreate,
      projectAllowsAgentCreation
    })

    // ✅ If should show request dialog, always open it
    if (shouldShowRequestDialog) {
      console.log('📝 Opening request dialog')
      setShowRequestDialog(true)
      return
    }
    
    // ✅ If genuinely disabled (at capacity), do nothing
    if (isCreateButtonDisabled) {
      console.log('🚫 Button disabled - at capacity')
      return
    }
    
    // ✅ All checks passed - create agent
    console.log('✅ Opening agent creation form')
    onCreateAgent()
  }
  
  // Show skeleton while loading
  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg
            bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
            animate-pulse
            ${isMobile ? 'text-xs' : 'text-sm'}
          `}
        >
          <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="w-16 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          <div className="w-3.5 h-3.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>
        <div className="h-10 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {/* ✅ Show Usage Info if user can create and project allows */}
        {userCanCreate && hasValidAgentSetup && (
          <TooltipProvider>
            <Tooltip open={showDetails} onOpenChange={setShowDetails}>
              <TooltipTrigger asChild>
                <button
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg
                    ${hasReachedLimit 
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                      : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    }
                    hover:shadow-sm transition-all cursor-pointer
                    ${isMobile ? 'text-xs' : 'text-sm'}
                  `}
                >
                  <span className={`font-medium ${
                    hasReachedLimit 
                      ? 'text-red-700 dark:text-red-300' 
                      : 'text-blue-700 dark:text-blue-300'
                  }`}>
                    {activeCount}/{maxAgents} Pype Agents
                  </span>

                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        hasReachedLimit 
                          ? 'bg-red-500 dark:bg-red-400' 
                          : 'bg-blue-500 dark:bg-blue-400'
                      }`}
                      style={{ width: `${Math.min(100, usagePercentage)}%` }}
                    />
                  </div>

                  <Info className={`w-3.5 h-3.5 ${
                    hasReachedLimit 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-blue-600 dark:text-blue-400'
                  }`} />
                </button>
              </TooltipTrigger>

              <TooltipContent 
                side="bottom" 
                align="end"
                className="w-80 p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
              >
                <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-800 ${
                  hasReachedLimit 
                    ? 'bg-red-50 dark:bg-red-900/20' 
                    : 'bg-blue-50 dark:bg-blue-900/20'
                }`}>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Pype Agent Usage
                  </h3>
                  <p className={`text-xs mt-0.5 ${
                    hasReachedLimit 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {hasReachedLimit 
                      ? 'You\'ve reached your agent limit' 
                      : `${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} remaining`
                    }
                  </p>
                </div>

                <div className="px-4 py-3 space-y-2">
                  {agentsList.length > 0 ? (
                    <>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Active Agents:
                      </p>
                      <div className="space-y-1.5">
                        {agentsList.map((agent) => (
                          <div 
                            key={agent.id}
                            className="flex items-center justify-between py-1.5 px-2 rounded-md bg-gray-50 dark:bg-gray-800"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {agent.name}
                              </p>
                              {agent.phone_number && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {agent.phone_number}
                                </p>
                              )}
                            </div>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              agent.status === 'active' 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {agent.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No active agents yet
                    </p>
                  )}
                </div>

                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {hasReachedLimit 
                      ? 'Delete an existing agent to create a new one'
                      : 'You can create up to ' + maxAgents + ' Pype agents'
                    }
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Create Agent Button */}
        <Button 
          onClick={handleCreateAgentClick}
          disabled={isCreateButtonDisabled}
          className={`px-4 py-2.5 text-sm font-medium shadow-sm ${
            shouldShowRequestDialog
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700'
              : isCreateButtonDisabled
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white'
          }`}
          title={
            isCreateButtonDisabled 
              ? 'Agent limit reached' 
              : shouldShowRequestDialog 
              ? 'Click to request access' 
              : isSuperAdmin 
              ? 'Create Agent (Superadmin Access)'
              : 'Create Agent'
          }
        >
          {shouldShowRequestDialog ? (
            <Lock className="w-4 h-4 mr-2" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Create Agent
          {shouldShowRequestDialog && !isSuperAdmin && (
            <span className="ml-1 text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded border border-gray-300 dark:border-gray-600">
              Beta
            </span>
          )}
        </Button>
      </div>

      {/* Request Access Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl bg-white dark:bg-gray-900 max-h-[90vh] flex flex-col">
          <DialogHeader className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'} flex-shrink-0`}>
            <DialogTitle className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100`}>
              Request Access
            </DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Tell us why you'd like to create agents with Pype
            </p>
          </DialogHeader>

          <div className={`flex-1 ${isMobile ? 'px-4 py-4' : 'px-6 py-6'} space-y-4 overflow-y-auto`}>
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
                    disabled={requestLoading}
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

          {!success && (
            <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex gap-3 flex-shrink-0`}>
              <Button
                variant="outline"
                onClick={() => setShowRequestDialog(false)}
                disabled={requestLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRequest}
                disabled={requestLoading || !reason.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
              >
                {requestLoading ? (
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
        </DialogContent>
      </Dialog>
    </>
  )
}

export default PypeAgentUsage