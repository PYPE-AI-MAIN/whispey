'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSupabaseQuery } from '../../hooks/useSupabase'
import AgentToolbar from './AgentToolbar'
import AgentList from './AgentList'
import AgentEmptyStates from './AgentEmptyStates'
import AgentDeleteDialog from './AgentDeleteDialog'
import AdaptiveTutorialEmptyState from './AdaptiveTutorialEmptyState'
import Header from '../shared/Header'
import AgentCreationDialog from './AgentCreation/AgentCreationDialog'

interface Agent {
  id: string
  name: string
  agent_type: string
  configuration: any
  environment: string
  created_at: string
  is_active: boolean
  project_id: string
}

interface AgentSelectionProps {
  projectId: string
}

const AgentSelection: React.FC<AgentSelectionProps> = ({ projectId }) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Agent | null>(null)
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [breadcrumb, setBreadcrumb] = useState<{
    project?: string;
    item?: string;
  }>({
    project: '',
    item: ''
  })
  const router = useRouter()

  // Fetch project data
  const { data: projects, loading: projectLoading, error: projectError } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active',
    filters: [{ column: 'id', operator: 'eq', value: projectId }]
  })

  const project = projects?.[0]

  useEffect(() => {
    if (projectId && project) {
      setBreadcrumb({
        project: project.name,
        item: 'Monitoring'
      })
    }
  }, [projectId, project])

  // Fetch agents data
  const { data: agents, loading: agentsLoading, error: agentsError, refetch } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, configuration, environment, created_at, is_active, project_id',
    filters: [
      { column: 'project_id', operator: 'eq', value: projectId }
    ],
    orderBy: { column: 'created_at', ascending: false }
  })

  const handleCreateAgent = () => {
    setShowCreateDialog(true)
    setShowHelpDialog(false)
  }

  const handleShowHelp = () => {
    setShowHelpDialog(true)
  }

  const handleAgentCreated = (agentData: any) => {
    refetch()
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

  // Filter agents based on search and status
  const filteredAgents = (agents || []).filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    return (
      <p>Loading...</p> // TODO: fix


      
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header breadcrumb={breadcrumb} />
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-5 max-w-sm">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-red-400 dark:text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Unable to Load Monitoring</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">{error}</p>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-6xl mx-auto px-8 py-8">
        <AgentToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onCreateAgent={handleCreateAgent}
          onShowHelp={filteredAgents.length > 0 ? handleShowHelp : undefined}
        />

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
            onCreateAgent={handleCreateAgent}
          />
        )}
      </main>

      {/* Dialogs */}
      <AgentCreationDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onAgentCreated={handleAgentCreated}
        projectId={projectId}
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
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowHelpDialog(false)}
          />
          
          {/* Slide-out Sheet */}
          <div className="fixed right-0 top-0 h-full w-4/5 bg-white dark:bg-gray-900 z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-l border-gray-300 dark:border-gray-700 flex-shrink-0 bg-gray-100 dark:bg-gray-800">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Integration Guide</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Add monitoring to your voice agents</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHelpDialog(false)}
                className="h-8 w-8 p-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <AdaptiveTutorialEmptyState
                searchQuery=""
                totalAgents={agents?.length || 0}
                onClearSearch={() => {}}
                onCreateAgent={() => {
                  setShowHelpDialog(false)
                  handleCreateAgent()
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AgentSelection