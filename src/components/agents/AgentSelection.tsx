'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { 
  ChevronLeft, 
  Bot, 
  Search, 
  Plus, 
  Loader2, 
  AlertCircle, 
  MoreHorizontal, 
  Trash2, 
  Copy, 
  Settings, 
  Clock, 
  Filter, 
  SortDesc, 
  Grid3X3, 
  List,
  CheckCircle2,
  Pause,
  BarChart3,
  Terminal,
  Code2,
  Eye,
  Globe,
  MonitorSpeaker,
  ExternalLink
} from 'lucide-react'
import { useSupabaseQuery } from '../../hooks/useSupabase'
import AgentCreationDialog from './AgentCreationDialog'
import Header from '../shared/Header'

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
  const [deletingAgent, setDeletingAgent] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Agent | null>(null)
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const router = useRouter()

  // Fetch project data
  const { data: projects, loading: projectLoading, error: projectError } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active',
    filters: [{ column: 'id', operator: 'eq', value: projectId }]
  })

  const project = projects?.[0]

  const breadcrumb = project ? {
    project: project.name,
  } : undefined

  // Fetch agents data
  const { data: agents, loading: agentsLoading, error: agentsError, refetch } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, configuration, environment, created_at, is_active, project_id',
    filters: [
      { column: 'project_id', operator: 'eq', value: projectId }
    ],
    orderBy: { column: 'created_at', ascending: false }
  })

  const handleAgentClick = (agent: Agent) => {
    setSelectedAgent(agent.id)
    setTimeout(() => {
      router.push(`/agents/${agent.id}`)
    }, 150)
  }

  const handleBack = () => {
    router.push('/')
  }

  const handleCreateAgent = () => {
    setShowCreateDialog(true)
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
        throw new Error(errorData.error || 'Failed to delete agent')
      }

      refetch()
      setShowDeleteConfirm(null)
    } catch (error: unknown) {
      console.error('Error deleting agent:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete agent'
      alert(`Failed to delete agent: ${errorMessage}`)
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
      console.error('Failed to copy agent ID:', err)
    }
  }

  const getAgentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'inbound':
        return <MonitorSpeaker className="w-4 h-4" />
      case 'outbound':
        return <Globe className="w-4 h-4" />
      case 'custom':
        return <Code2 className="w-4 h-4" />
      default:
        return <Bot className="w-4 h-4" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
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
      <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
        <Header breadcrumb={breadcrumb} />
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-medium text-gray-600">Loading agents</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
        <Header breadcrumb={breadcrumb} />
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-6 max-w-sm">
            <div className="w-16 h-16 bg-white rounded-2xl border border-gray-200 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Unable to Load Agents</h3>
              <p className="text-sm text-gray-500 mt-2">{error}</p>
            </div>
            <Button 
              onClick={() => window.location.reload()} 
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
      <Header breadcrumb={breadcrumb} />
      
      <main className="max-w-6xl mx-auto px-8 py-8">
        {/* Apple-Style Clean Toolbar */}
        <div className="flex items-center justify-between mb-8">
          {/* Left: Simple Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search agents"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
            />
          </div>

          {/* Right: Minimal Controls */}
          <div className="flex items-center gap-4">
            {/* Clean Filter Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  statusFilter === 'all' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  statusFilter === 'active' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  statusFilter === 'inactive' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Inactive
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white shadow-sm text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-white shadow-sm text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
            
            <Button 
              onClick={handleCreateAgent}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Agent
            </Button>
          </div>
        </div>

        {/* Apple-Style Agent List */}
        {viewMode === 'list' ? (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {filteredAgents.map((agent, index) => (
              <div
                key={agent.id}
                className={`group px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                  selectedAgent === agent.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleAgentClick(agent)}
              >
                <div className="flex items-center justify-between">
                  {/* Left: Agent Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {getAgentTypeIcon(agent.agent_type)}
                      <div className={`absolute w-3 h-3 rounded-full border-2 border-white -bottom-0.5 -right-0.5 ${
                        agent.is_active ? 'bg-green-500' : 'bg-gray-300'
                      }`}></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">{agent.name}</h3>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {agent.agent_type}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          agent.environment === 'production' || agent.environment === 'prod'
                            ? 'bg-red-100 text-red-700'
                            : agent.environment === 'staging' || agent.environment === 'stage'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {agent.environment}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>ID: {agent.id.slice(0, 8)}...{agent.id.slice(-4)}</span>
                        <span>Created {formatDate(agent.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status & Actions */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-sm font-medium ${agent.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 bg-white/95 backdrop-blur-lg border border-gray-200 rounded-lg shadow-lg">
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                          <Eye className="h-4 w-4 mr-3 text-gray-500" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                          <BarChart3 className="h-4 w-4 mr-3 text-gray-500" />
                          Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                          <Settings className="h-4 w-4 mr-3 text-gray-500" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleCopyAgentId(agent.id, e)
                        }} className="text-sm">
                          <Copy className="h-4 w-4 mr-3 text-gray-500" />
                          Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          setShowDeleteConfirm(agent)
                        }} className="text-red-600 focus:text-red-600 text-sm">
                          <Trash2 className="h-4 w-4 mr-3" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className={`group bg-white border border-gray-200 rounded-lg hover:shadow-sm cursor-pointer transition-all duration-200 ${
                  selectedAgent === agent.id ? 'ring-1 ring-blue-500 border-blue-300' : 'hover:border-gray-300'
                }`}
                onClick={() => handleAgentClick(agent)}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                        {getAgentTypeIcon(agent.agent_type)}
                        <div className={`absolute w-3 h-3 rounded-full border-2 border-white -bottom-0.5 -right-0.5 ${
                          agent.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 truncate">{agent.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{agent.agent_type}</p>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 p-0 text-gray-400 hover:text-gray-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleCopyAgentId(agent.id, e)
                        }} className="text-sm">
                          <Copy className="h-4 w-4 mr-2" />
                          Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          setShowDeleteConfirm(agent)
                        }} className="text-red-600 focus:text-red-600 text-sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Environment Badge */}
                  <div className="mb-4">
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md ${
                      agent.environment === 'production' || agent.environment === 'prod'
                        ? 'bg-red-100 text-red-700'
                        : agent.environment === 'staging' || agent.environment === 'stage'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {agent.environment}
                    </span>
                  </div>

                  {/* Agent ID */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">Agent ID</div>
                        <code className="text-xs text-gray-700 font-mono">
                          {agent.id.slice(0, 8)}...{agent.id.slice(-4)}
                        </code>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleCopyAgentId(agent.id, e)}
                        className="w-8 h-8 p-0 text-gray-400 hover:text-gray-600"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {copiedAgentId === agent.id && (
                      <p className="text-xs text-green-600 mt-2">Copied!</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDate(agent.created_at)}</span>
                    </div>
                    <div className={`font-medium ${agent.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                      {agent.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Apple-Style Empty States */}
        {filteredAgents.length === 0 && searchQuery && (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              No agents match your search criteria. Try adjusting your search terms.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setSearchQuery('')}
              className="border-gray-300 text-gray-700"
            >
              Clear Search
            </Button>
          </div>
        )}

        {filteredAgents.length === 0 && !searchQuery && (agents || []).length === 0 && (
          <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <Bot className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-3">No Agents Yet</h3>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
              Create your first voice AI agent to start handling calls and conversations for this project.
            </p>
            <Button 
              onClick={handleCreateAgent}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </div>
        )}
      </main>

      {/* Dialogs */}
      <AgentCreationDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onAgentCreated={handleAgentCreated}
        projectId={projectId}
      />

      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-lg border border-gray-200 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-gray-900">Delete Agent</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2">
              Are you sure you want to delete "{showDeleteConfirm?.name}"? This action cannot be undone and will permanently remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(null)} 
              className="flex-1 border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => showDeleteConfirm && handleDeleteAgent(showDeleteConfirm)}
              disabled={deletingAgent !== null}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
            >
              {deletingAgent ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete Agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AgentSelection