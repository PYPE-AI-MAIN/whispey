'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  ChevronRight,
  ChevronLeft, 
  Loader2, 
  AlertCircle,
  Search,
  Bot,
  Plus
} from 'lucide-react'
import { useSupabaseQuery } from '../../hooks/useSupabase'

interface Agent {
  id: string
  name: string
  agent_type: string
  configuration: any
  environment: string
  created_at: string
  is_active: boolean
}

interface AgentSelectionProps {
  projectId: string
}

const AgentSelection: React.FC<AgentSelectionProps> = ({ projectId }) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  // Fetch project data
  const { data: projects, loading: projectLoading, error: projectError } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active',
    filters: [{ column: 'id', operator: 'eq', value: projectId }]
  })

  const project = projects?.[0]

  // Fetch agents data
  const { data: agents, loading: agentsLoading, error: agentsError } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, configuration, environment, created_at, is_active',
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

  if (error || !project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
          <p className="text-gray-600 max-w-md">
            Unable to load data: {error || 'Project not found'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Simple Header */}
      <header className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={handleBack} className="mb-4 -ml-3">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
            <p className="text-gray-500 mt-1">Choose an agent</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Search */}
          <div className="max-w-md mx-auto mb-12">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border-0 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder:text-gray-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0"
              />
            </div>
          </div>

          {/* Agents Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {filteredAgents.map((agent) => {
              const color = getAgentColor(agent.name)
              return (
                <Card
                  key={agent.id}
                  className={`group cursor-pointer border-0 bg-gray-50/50 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-gray-200/50 ${
                    selectedAgent === agent.id 
                      ? 'scale-[0.98] opacity-60' 
                      : ''
                  }`}
                  onClick={() => handleAgentClick(agent)}
                >
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <Avatar className={`h-12 w-12 ${getAgentIcon(color)}`}>
                        <AvatarFallback className={`${getAgentIcon(color)} text-white`}>
                          <Bot className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      
                      <ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1" />
                    </div>

                    {/* Agent Info */}
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {agent.name}
                      </h3>
                      <p className="text-sm text-gray-600 capitalize">
                        {agent.agent_type}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant={agent.environment === 'production' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {agent.environment}
                      </Badge>
                      
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        <span className="text-xs text-gray-600">Active</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Add New Agent Card */}
            <Card className="group cursor-pointer border-2 border-dashed border-gray-200 bg-transparent transition-all duration-200 hover:border-gray-300 hover:bg-gray-50/50">
              <CardContent className="flex flex-col items-center justify-center p-6 min-h-[180px]">
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
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your search or create a new agent
              </p>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default AgentSelection