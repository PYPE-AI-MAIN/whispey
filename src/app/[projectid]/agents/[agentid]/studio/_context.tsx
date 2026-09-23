'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { useAgentById } from '@/hooks/useAgentById'
import { useSupabaseQuery } from '@/hooks/useSupabase'

interface StudioContextValue {
  projectId: string
  agentId: string
  agent: any
  project: any
  /** Backend agent name (e.g. Test_uuid) used by /agent_config, /knowledge/*, etc. */
  backendAgentName: string
  isLoading: boolean
}

const StudioContext = createContext<StudioContextValue | null>(null)

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used within StudioProvider')
  return ctx
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const params = useParams()
  const projectId = (Array.isArray(params?.projectid) ? params.projectid[0] : params?.projectid) ?? ''
  const agentId = (Array.isArray(params?.agentid) ? params.agentid[0] : params?.agentid) ?? ''

  const { data: agentData, isLoading: agentLoading } = useAgentById(agentId)
  const agent = agentData ?? null

  const { data: projects, isLoading: projectLoading } = useSupabaseQuery(
    'pype_voice_projects',
    {
      select: 'id, name, description, environment, created_at, is_active',
      filters: agent?.project_id
        ? [{ column: 'id', operator: 'eq', value: agent.project_id }]
        : [{ column: 'id', operator: 'eq', value: 'never-match' }],
      auth: agent?.project_id ? { projectId: agent.project_id } : undefined,
    }
  )
  const project = agent?.project_id ? (projects?.[0] ?? null) : null

  const backendAgentName = useMemo(() => {
    if (!agent?.name || !agentId) return ''
    return `${agent.name}_${agentId.replace(/-/g, '_')}`
  }, [agent?.name, agentId])

  const value = useMemo<StudioContextValue>(() => ({
    projectId,
    agentId,
    agent,
    project,
    backendAgentName,
    isLoading: agentLoading || projectLoading,
  }), [projectId, agentId, agent, project, backendAgentName, agentLoading, projectLoading])

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}
