'use client'

import { useCallback, useEffect, useState } from 'react'

export interface AgentStatus {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  pid?: number
  error?: string
  message?: string
}

async function checkAgentStatus(agentName: string): Promise<AgentStatus> {
  try {
    const res = await fetch(`/api/agents/status/${encodeURIComponent(agentName)}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { status: 'error', error: err.error || `Failed to check status: ${res.status}` }
    }
    const data = await res.json()
    if (data.backend_unavailable) return { status: 'stopped', error: 'Voice backend unreachable' }
    const running = data.is_active && data.worker_running
    let error: string | undefined
    if (running) error = undefined
    else if (data.is_active) error = 'Worker not running'
    else error = 'Agent not active'
    return { status: running ? 'running' : 'stopped', pid: data.worker_pid, error }
  } catch {
    return { status: 'error', error: 'Connection error' }
  }
}

/** Whether the backend knows this agent (every agent runs on the shared worker pool — there is no start/stop). */
export function useAgentLifecycle(agentName: string | undefined) {
  const [status, setStatus] = useState<AgentStatus>({ status: 'stopped' })

  const refresh = useCallback(async () => {
    if (!agentName) return
    setStatus(await checkAgentStatus(agentName))
  }, [agentName])

  useEffect(() => {
    if (agentName) refresh()
  }, [agentName, refresh])

  return { status, isLoading: false, refresh }
}
