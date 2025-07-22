'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ChevronLeft, 
  Bot,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  Book,
  ExternalLink,
  Copy
} from 'lucide-react'
import { useSupabaseQuery } from '../../hooks/useSupabase'
import AgentCreationDialog from './AgentCreationDialog'
import Link from 'next/link'

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
  const router = useRouter()

  // Fetch project data
  const { data: projects, loading: projectLoading, error: projectError } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active',
    filters: [{ column: 'id', operator: 'eq', value: projectId }]
  })

  const project = projects?.[0]

  // Fetch agents data
  const { data: agents, loading: agentsLoading, error: agentsError, refetch } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, configuration, environment, created_at, is_active, project_id',
    filters: [
      { column: 'project_id', operator: 'eq', value: projectId },
      { column: 'is_active', operator: 'eq', value: true }
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
    // Refresh the agents list to include the new agent
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

      const result = await response.json()
      console.log('Agent deleted successfully:', result)
      
      // Refresh the agents list
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

  const getAgentColor = (name: string) => {
    const colors = ['blue', 'green', 'purple', 'orange', 'pink']
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  const getAgentIcon = (color: string) => {
    const colorClasses = {
      blue: "bg-blue-500",
      green: "bg-green-500", 
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      pink: "bg-pink-500"
    }
    return colorClasses[color as keyof typeof colorClasses] || "bg-gray-500"
  }

  // Filter agents based on search
  const filteredAgents = agents?.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.agent_type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const loading = projectLoading || agentsLoading
  const error = projectError || agentsError

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading agents...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
          <p className="text-gray-600 max-w-md">
            Unable to load agents: {error}
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {project?.name || 'Project'}
              </h1>
              <p className="text-sm text-gray-600">
                AI Agents • {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/docs">
              <Button variant="ghost" size="sm">
                <Book className="h-4 w-4 mr-2" />
                API Docs
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </Link>
            <Button onClick={handleCreateAgent}>
              <Plus className="h-4 w-4 mr-2" />
              New Agent
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Search Bar */}
          <div className="max-w-md mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border-0 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder:text-gray-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0"
              />
            </div>
          </div>

          {/* Agents Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => {
              const color = getAgentColor(agent.name)
              
              return (
                <Card
                  key={agent.id}
                  className={`group border-0 bg-gray-50/50 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-gray-200/50 ${
                    selectedAgent === agent.id 
                      ? 'scale-[0.98] opacity-60' 
                      : ''
                  }`}
                >
                  <CardContent className="p-6">
                    {/* Header with Actions */}
                    <div className="flex items-start justify-between mb-4">
                      <Avatar className={`h-12 w-12 ${getAgentIcon(color)}`}>
                        <AvatarFallback className={`${getAgentIcon(color)} text-white`}>
                          <Bot className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowDeleteConfirm(agent)
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Agent
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Agent Info - Clickable */}
                    <div 
                      className="cursor-pointer space-y-4" 
                      onClick={() => handleAgentClick(agent)}
                    >
                      {/* Basic Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">
                          {agent.name}
                        </h3>
                        <p className="text-sm text-gray-600 capitalize">
                          {agent.agent_type.replace('_', ' ')}
                        </p>
                      </div>

                      {/* Agent ID Section */}
                      <div className="p-3 bg-gray-100/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">Agent ID</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleCopyAgentId(agent.id, e)}
                            className="h-6 w-6 p-0 hover:bg-gray-200"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <code className="text-xs bg-white px-2 py-1 rounded border text-gray-600 font-mono block truncate">
                          {agent.id}
                        </code>
                        {copiedAgentId === agent.id && (
                          <p className="text-xs text-green-600 mt-1">Agent ID copied!</p>
                        )}
                      </div>

                      {/* Status & Environment */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            {agent.environment}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-green-700 border-green-200">
                            Active
                          </Badge>
                        </div>
                      </div>

                      {/* Creation Date */}
                      <p className="text-xs text-gray-500">
                        Created {new Date(agent.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Create New Agent Card */}
            <Card 
              className="group cursor-pointer border-2 border-dashed border-gray-200 bg-transparent transition-all duration-200 hover:border-gray-300 hover:bg-gray-50/50"
              onClick={handleCreateAgent}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 min-h-[200px]">
                <div className="rounded-full bg-gray-100 p-3 mb-3 group-hover:bg-gray-200 transition-colors">
                  <Plus className="h-6 w-6 text-gray-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">New Agent</h3>
                <p className="text-sm text-gray-600 text-center">
                  Create a new AI agent
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Empty State */}
          {filteredAgents.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <Search className="h-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your search or create a new agent
              </p>
              <Button variant="outline" onClick={handleCreateAgent}>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Agent Creation Dialog */}
      <AgentCreationDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onAgentCreated={handleAgentCreated}
        projectId={projectId}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Agent</h3>
              <p className="text-gray-600 text-sm">
                Are you sure you want to delete "{showDeleteConfirm.name}"? This will permanently delete the agent and all related data. This action cannot be undone.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deletingAgent === showDeleteConfirm.id}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleDeleteAgent(showDeleteConfirm)}
                disabled={deletingAgent === showDeleteConfirm.id}
              >
                {deletingAgent === showDeleteConfirm.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete Agent
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentSelection