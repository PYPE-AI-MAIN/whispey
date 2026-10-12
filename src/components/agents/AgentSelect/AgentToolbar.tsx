import React, { useState } from 'react'
import { Search, Eye, Grid3X3, List, HelpCircle, Plus, ArrowUpDown, Lock, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useMobile } from '@/hooks/use-mobile'
import PypeAgentUsage from './PypeAgentUsage'
import { useParams } from 'next/navigation'
import { useUserPermissions } from '@/contexts/UserPermissionsContext'
import { useFeatureAccess } from '@/app/providers/FeatureAccessProvider'
import type { EmailNotificationRequest, EmailNotificationResponse } from '@/types/email-notifications'

interface AgentToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: string
  onStatusFilterChange: (filter: string) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onCreateAgent: () => void
  onConnectAgent: () => void
  onShowHelp?: () => void
  sortOrder: 'asc' | 'desc'
  onSortToggle: () => void
  agentCount?: number
}

const AgentToolbar: React.FC<AgentToolbarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  onCreateAgent,
  onConnectAgent,
  onShowHelp,
  sortOrder,
  onSortToggle,
  agentCount
}) => {
  const { projectid } = useParams()
  const { isMobile } = useMobile(768)
  const { permissions, canCreatePypeAgent, loading: permissionsLoading } = useUserPermissions({ projectId: projectid as string })
  const { canCreatePypeAgent: canCreateFromWhitelist } = useFeatureAccess()

  // Request access dialog state
  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Simple logic based on permissions
  const hasReachedLimit = permissions?.agent && 
    (permissions.agent.usage.active_count >= permissions.agent.limits.max_agents)
  
  // Show Create Agent only if user is on whitelist, Connect Agent always
  const showCreateButton = canCreateFromWhitelist
  const showConnectButton = true
  const isCreateButtonDisabled = !canCreatePypeAgent || hasReachedLimit

  const handleSubmitRequest = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for requesting access')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const requestBody: EmailNotificationRequest = {
        type: 'agent_permission',
        description: `${reason.trim()}\n\nProject ID: ${projectid}`
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
        // Reset state after closing
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
      setLoading(false)
    }
  }

  const handleCreateAgentClick = () => {
    if (isCreateButtonDisabled && !hasReachedLimit) {
      // Show request access dialog for beta users
      setShowRequestDialog(true)
    } else {
      // Normal create agent flow
      onCreateAgent()
    }
  }

  const renderContent = () => {
    if (isMobile) {
      return (
        <div className="space-y-3 mb-4">
        {/* Top Row: Search + Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="search"
              placeholder="Search agents"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:outline-none transition-all text-gray-900 dark:text-gray-100"
            />
          </div>
          
          {/* Mobile Actions */}
          <div className="flex items-center gap-1">
            {showCreateButton && (
              <Button 
                onClick={handleCreateAgentClick}
                disabled={hasReachedLimit}
                size="sm"
                className={`px-2 py-2.5 text-sm font-medium flex-shrink-0 ${
                  isCreateButtonDisabled
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white'
                }`}
                title={isCreateButtonDisabled ? (hasReachedLimit ? 'Agent limit reached' : 'Beta feature - click to request access') : 'Create Agent'}
              >
                {isCreateButtonDisabled ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            )}
            
            {showConnectButton && (
              <Button 
                onClick={onConnectAgent}
                size="sm"
                variant="outline"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-2.5 text-sm font-medium flex-shrink-0"
                title="Connect Agent"
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Middle Row: Usage Info */}
        <PypeAgentUsage projectId={projectid as string} />

        {/* Bottom Row: Sort + Help */}
        <div className="flex items-center justify-between">
          {/* Sort Toggle */}
          <button
            onClick={onSortToggle}
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors ${
              sortOrder === 'desc' 
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            }`}
            title={`Sort by date ${sortOrder === 'desc' ? '(newest first)' : '(oldest first)'}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === 'desc' ? 'DESC' : 'ASC'}
          </button>

          {/* Help Link */}
          {onShowHelp && (
            <button
              onClick={onShowHelp}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Help
            </button>
          )}
        </div>
      </div>
      )
    }

    const segment = 'flex items-center rounded-lg border border-border bg-muted/60 p-0.5'
    const segBtn = (on: boolean) =>
      `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`
    return (
      <div className="mb-6 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agents</h1>
            {agentCount !== undefined && (
              <p className="mt-1 text-sm text-muted-foreground">{agentCount} {agentCount === 1 ? 'agent' : 'agents'}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {showConnectButton && (
              <Button onClick={onConnectAgent} variant="outline" className="px-4 py-2.5 text-sm font-medium">
                <Eye className="mr-2 h-4 w-4" />
                Connect Agent
              </Button>
            )}
            {showCreateButton && (
              <Button
                onClick={handleCreateAgentClick}
                disabled={hasReachedLimit}
                className={`px-4 py-2.5 text-sm font-medium ${isCreateButtonDisabled ? 'cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted' : ''}`}
                title={isCreateButtonDisabled ? (hasReachedLimit ? 'Agent limit reached' : 'Beta feature - click to request access') : 'Create a new agent'}
              >
                {isCreateButtonDisabled ? <Lock className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                Create Agent
                {!canCreatePypeAgent && (
                  <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Beta</span>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search agents"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <div className={segment} role="group" aria-label="Filter by status">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button key={f} onClick={() => onStatusFilterChange(f)} className={segBtn(statusFilter === f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className={segment} role="group" aria-label="View and sort">
            <button
              onClick={onSortToggle}
              className={`flex items-center gap-1.5 ${segBtn(false)}`}
              title={`Sort by date ${sortOrder === 'desc' ? '(newest first)' : '(oldest first)'}`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </button>
            <button onClick={() => onViewModeChange('list')} className={segBtn(viewMode === 'list')} title="List view" aria-label="List view">
              <List className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onViewModeChange('grid')} className={segBtn(viewMode === 'grid')} title="Grid view" aria-label="Grid view">
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
          </div>

          <PypeAgentUsage projectId={projectid as string} />

          {onShowHelp && (
            <button
              onClick={onShowHelp}
              title="About agent types"
              aria-label="About agent types"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {renderContent()}
      
      {/* Request Access Dialog */}
    <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
      <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl bg-white dark:bg-gray-900 max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'} flex-shrink-0`}>
          <DialogTitle className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100`}>
            Request Access
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Tell us why you'd like to create agents with Pype
          </p>
        </DialogHeader>

        {/* Content */}
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
              onClick={() => setShowRequestDialog(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
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
      </DialogContent>
    </Dialog>
    </>
  )
}

export default AgentToolbar