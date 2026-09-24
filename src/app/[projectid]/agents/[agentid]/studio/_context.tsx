'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { useAgentById } from '@/hooks/useAgentById'

interface StudioContextValue {
  projectId: string
  agentId: string
  agent: any
  /** Backend agent name (e.g. Test_uuid) used by /agent_config, LiveKit sessions, etc. */
  backendAgentName: string
  isLoading: boolean
  refetchAgent: () => void
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

  const { data: agentData, isLoading, refetch } = useAgentById(agentId)
  const agent = agentData ?? null

  const backendAgentName = useMemo(() => {
    if (!agent?.name || !agentId) return ''
    return `${agent.name}_${agentId.replace(/-/g, '_')}`
  }, [agent?.name, agentId])

  const value = useMemo<StudioContextValue>(() => ({
    projectId,
    agentId,
    agent,
    backendAgentName,
    isLoading,
    refetchAgent: () => { refetch() },
  }), [projectId, agentId, agent, backendAgentName, isLoading, refetch])

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}
