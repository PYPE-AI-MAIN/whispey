'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft,
  BarChart3, 
  List,
  Loader2,
  AlertCircle,
  Database
} from 'lucide-react'
import Overview from './Overview'
import CallLogs from './CallLogs'
import CampaignLogs from './CampaignLogs'

import { useSupabaseQuery } from '../../hooks/useSupabase'
import FieldExtractorDialog from './FieldExtractorLogs'
import { supabase } from '../../lib/supabase'

interface DashboardProps {
  agentId: string
}

const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'

const Dashboard: React.FC<DashboardProps> = ({ agentId }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Get active tab from URL params, default to 'overview'
  const activeTab = searchParams.get('tab') || 'overview'
  
  // Only fetch data if agentId is valid
  const shouldFetch = agentId && agentId !== 'undefined' && agentId.trim() !== ''

  // Fetch agent data
  const { data: agents, loading: agentLoading, error: agentError ,refetch: refetchAgent} = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, configuration, environment, created_at, is_active, project_id,field_extractor_prompt,field_extractor',
    filters: shouldFetch ? [{ column: 'id', operator: 'eq', value: agentId }] : []
  })

  const agent = shouldFetch ? agents?.[0] : null

  // Fetch project data based on agent's project_id
  const { data: projects, loading: projectLoading, error: projectError } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active',
    filters: (shouldFetch && agent?.project_id) ? [{ column: 'id', operator: 'eq', value: agent.project_id }] : []
  })

  const project = (shouldFetch && agent?.project_id) ? projects?.[0] : null

  const handleBack = () => {
    if (agent?.project_id) {
      router.push(`/${agent.project_id}/agents`)
    } else {
      router.push('/')
    }
  }

  const handleTabChange = (tab: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    current.set('tab', tab)
    const search = current.toString()
    const query = search ? `?${search}` : ""
    router.push(`/agents/${agentId}${query}`)
  }



  // Set default tab if none specified
  useEffect(() => {
    if (!searchParams.get('tab')) {
      handleTabChange('overview')
    }
  }, [searchParams])

  // Check if this is the enhanced project
  const isEnhancedProject = agent?.project_id === ENHANCED_PROJECT_ID

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'logs', label: 'Call Logs', icon: List },
    ...(isEnhancedProject ? [{ id: 'campaign-logs', label: 'Campaign Logs', icon: Database }] : [])
  ]

  // Show error if agentId is invalid
  if (!shouldFetch) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Invalid Agent ID</h2>
          <p className="text-gray-600 max-w-md">
            The agent ID is missing or invalid: &quot;{agentId}&quot;
          </p>
          <Button variant="outline" onClick={() => router.push('/')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  if (agentLoading || (shouldFetch && projectLoading)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (agentError || projectError || !agent) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
          <p className="text-gray-600 max-w-md">
            Unable to load agent data: {agentError || projectError || 'Agent not found'}
          </p>
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Simple Header */}
      <header className="flex-none px-6 py-2 items-center border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto flex row justify-between items-center">
          <Button variant="ghost" onClick={handleBack} className="-ml-3 hover:bg-white/50">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
          
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-center gap-4">              
              {/* Navigation Tabs */}
              <nav className="flex space-x-2 bg-white/70 backdrop-blur-sm rounded-xl p-2 shadow-sm border border-white/50 lg:flex-shrink-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-white text-gray-900 shadow-md ring-1 ring-gray-200'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>

              <FieldExtractorDialog
                initialData={JSON.parse(agent?.field_extractor_prompt) || []}
                isEnabled={!!agent?.field_extractor}
                onSave={async (data, enabled) => {
                  const { error } = await supabase
                    .from('pype_voice_agents')
                    .update({ field_extractor_prompt: JSON.stringify(data)  , field_extractor: enabled })
                    .eq('id', agent.id)

                  if (!error) {
                    alert('Saved field extractor config.')
                    refetchAgent() // optional if you want fresh data
                  } else {
                    alert('Error saving config: ' + error.message)
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        {activeTab === 'overview' && (
          <Overview project={project} agent={agent} />
        )}
        {activeTab === 'logs' && (
          <CallLogs project={project} agent={agent} onBack={handleBack} />
        )}
        {activeTab === 'campaign-logs' && isEnhancedProject && (
          <CampaignLogs project={project} agent={agent} onBack={handleBack} />
        )}
      </main>


    </div>
  )
}

export default Dashboard