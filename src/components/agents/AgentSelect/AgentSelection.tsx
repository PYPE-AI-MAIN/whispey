// src/components/agents/AgentSelect/AgentSelection.tsx
'use client'

import React, { useCallback, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, X, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSupabaseQuery } from '../../../hooks/useSupabase'
import AgentToolbar from './AgentToolbar'
import AgentList from '../AgentList'
import AgentDeleteDialog from '../AgentDeleteDialog'
import AdaptiveTutorialEmptyState from './EmptyStates/AdaptiveTutorialEmptyState'
import AgentCreationDialog from '../AgentCreation/AgentCreationDialog'
import AgentSelectionSkeleton from './AgentSelectionSkeleton'
import AgentEmptyStates from './EmptyStates/AgentEmptyStates'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useMobile } from '@/hooks/use-mobile'
import { UserPermissionsProvider, useInvalidateUserPermissions } from '@/contexts/UserPermissionsContext'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { agentDisplayName } from '@/lib/agentDisplayName'

interface Agent {
  id: string
  /** Immutable backend identity — the label users see is `display_name`. */
  name: string
  display_name?: string | null
  agent_type: string
  configuration: any
  environment: string
  created_at: string
  is_active: boolean
  project_id: string
}



const AgentSelectionContent: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [initialFlow, setInitialFlow] = useState<'choice' | 'create' | 'connect'>('choice')
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Agent | null>(null)
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try { return (localStorage.getItem('agents_view_mode') as 'grid' | 'list') || 'list' } catch { return 'list' }
  })
  const handleViewModeChange = useCallback((mode: 'grid' | 'list') => {
    setViewMode(mode)
    try { localStorage.setItem('agents_view_mode', mode) } catch {}
  }, [])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  // const router = useRouter()

  const invalidatePermissions = useInvalidateUserPermissions()

  const { isMobile } = useMobile(768)

  // Fetch project data
  const { isLoading: projectLoading, error: projectError } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active, plans, agent',
    filters: [{ column: 'id', operator: 'eq', value: projectId }]
  })

  // Fetch agents data
  const { data: agents, isLoading: agentsLoading, error: agentsError, refetch } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, display_name, agent_type, configuration, environment, created_at, is_active, project_id',
    filters: [
      { column: 'project_id', operator: 'eq', value: projectId }
    ],
    orderBy: { column: 'created_at', ascending: sortOrder === 'asc' }
  })

  const handleCreateAgent = () => {
    setInitialFlow('create')
    setShowCreateDialog(true)
    setShowHelpDialog(false)
  }

  const handleConnectAgent = () => {
    setInitialFlow('connect')
    setShowCreateDialog(true)
    setShowHelpDialog(false)
  }

  const handleShowHelp = () => {
    setShowHelpDialog(true)
  }

  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
  }

  const handleAgentCreated = (agentData: any) => {
    refetch()
    if (agentData.agent_type === 'pype_agent') {
      invalidatePermissions(projectId)
    }
  }

  const handleDeleteAgent = async (agent: Agent) => {
    setDeletingAgent(agent.id)
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })
  
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove monitoring')
      }
  
      refetch()
      setShowDeleteConfirm(null)
      
      if (agent.agent_type === 'pype_agent') {
        invalidatePermissions(projectId) // Pass projectId
      }
    } catch (error: unknown) {
      console.error('Error removing monitoring:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove monitoring'
      alert(`Failed to remove monitoring: ${errorMessage}`)
    } finally {
      setDeletingAgent(null)
    }
  }

  const handleCopyAgentId = async (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(agentId)
      setCopiedAgentId(agentId)
      setTimeout(() => setCopiedAgentId(null), 2000)
    } catch (err) {
      console.error('Failed to copy monitoring ID:', err)
    }
  }

  const { isOwnerOrAdmin } = useMemberVisibility(projectId)

  // All users can see the agents in their project (backend enforces access controls)
  const filteredAgents = (agents || []).filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agentDisplayName(agent).toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.agent_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.id.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && agent.is_active) ||
      (statusFilter === 'inactive' && !agent.is_active)
    
    return matchesSearch && matchesStatus
  })

  const loading = projectLoading || agentsLoading
  const error = projectError || agentsError

  if (loading) {
    return <AgentSelectionSkeleton />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/50">
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-5 max-w-sm">
            <div className="w-14 h-14 bg-card rounded-2xl border border-border flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-red-400 dark:text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">Unable to Load Monitoring</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{error.message}</p>
            </div>
            <Button 
              onClick={() => window.location.reload()} 
              className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    // Desktop: the page fills the shell's scroll area and only the list scrolls, so the
    // toolbar never moves (no sticky repositioning). Mobile keeps normal page scroll.
    <div className="min-h-screen bg-background md:flex md:h-full md:min-h-0 md:flex-col">
      <div className="wp-enter max-w-6xl mx-auto px-4 py-6 sm:px-8 sm:py-8 md:flex md:min-h-0 md:w-full md:flex-1 md:flex-col">
        <div className="md:shrink-0">
          <AgentToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onCreateAgent={handleCreateAgent}
            onConnectAgent={handleConnectAgent}
            onShowHelp={filteredAgents.length > 0 ? handleShowHelp : undefined}
            agentCount={filteredAgents.length}
            sortOrder={sortOrder}
            onSortToggle={handleSortToggle}
          />
        </div>

        {/* -m-1/p-1 leave room for card rings and shadows at the scroll edges */}
        <div className="md:-m-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:p-1">
          {filteredAgents.length > 0 ? (
            <AgentList
              agents={filteredAgents}
              viewMode={viewMode}
              selectedAgent={selectedAgent}
              copiedAgentId={copiedAgentId}
              projectId={projectId}
              onCopyAgentId={handleCopyAgentId}
              onDeleteAgent={setShowDeleteConfirm}
            />
          ) : (
            <AgentEmptyStates
              searchQuery={searchQuery}
              totalAgents={agents?.length || 0}
              onClearSearch={() => setSearchQuery('')}
              onCreateAgent={() => {
                setInitialFlow('choice')
                setShowCreateDialog(true)
              }}
            />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AgentCreationDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onAgentCreated={handleAgentCreated}
        projectId={projectId}
        initialFlow={initialFlow}
      />

      <AgentDeleteDialog
        agent={showDeleteConfirm}
        isDeleting={deletingAgent !== null}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={handleDeleteAgent}
      />

      {/* Help Sheet - Slide-out from right */}
      {showHelpDialog && (
        <>
          {/* Overlay */}
          <Sheet open={showHelpDialog} onOpenChange={setShowHelpDialog}>
            <SheetContent 
              side="right" 
              className="min-w-3/4 p-0 bg-card border-l border-border"
            >
              <SheetHeader className="p-6 border-b border-border bg-muted/50">
                <SheetTitle className="text-xl font-semibold text-foreground">
                  Integration Guide
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Add monitoring to your voice agents
                </SheetDescription>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto">
                <AdaptiveTutorialEmptyState
                  searchQuery=""
                  totalAgents={agents?.length || 0}
                  onClearSearch={() => {}}
                  onCreateAgent={() => {
                    setShowHelpDialog(false)
                    setInitialFlow('choice')
                    setShowCreateDialog(true)
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}

const AgentSelection = () => {
  const params = useParams()
  const projectId = params.projectid as string
  return (
      <AgentSelectionContent projectId={projectId} />
  )
}

export default AgentSelection