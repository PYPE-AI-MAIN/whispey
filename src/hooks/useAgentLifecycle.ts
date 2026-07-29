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
    return {
      status: data.is_active && data.worker_running ? 'running' : 'stopped',
      pid: data.worker_pid,
      error: !data.is_active ? 'Agent not active' : !data.worker_running ? 'Worker not running' : undefined,
    }
  } catch {
    return { status: 'error', error: 'Connection error' }
  }
}

async function callAgentAction(action: 'start_agent' | 'stop_agent', agentName: string): Promise<AgentStatus> {
  try {
    const res = await fetch(`/api/agents/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name: agentName }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { status: 'error', error: err.error || `Request failed: ${res.status}` }
    }
    return { status: action === 'start_agent' ? 'starting' : 'stopping' }
  } catch {
    return { status: 'error', error: `Failed to ${action === 'start_agent' ? 'start' : 'stop'} agent` }
  }
}

/** Start/stop/poll the per-agent worker process — same backend contract the classic Agent Config page uses. */
export function useAgentLifecycle(agentName: string | undefined) {
  const [status, setStatus] = useState<AgentStatus>({ status: 'stopped' })
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!agentName) return
    setStatus(await checkAgentStatus(agentName))
  }, [agentName])

  useEffect(() => {
    if (agentName) refresh()
  }, [agentName, refresh])

  const start = async () => {
    if (!agentName) return
    setIsLoading(true)
    setStatus({ status: 'starting' })
    try {
      const started = await callAgentAction('start_agent', agentName)
      if (started.status === 'error') {
        setStatus(started)
        return
      }
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((r) => setTimeout(r, 1000))
        const polled = await checkAgentStatus(agentName)
        setStatus(polled)
        if (polled.status === 'running' || polled.status === 'error') return
      }
    } finally {
      setIsLoading(false)
    }
  }

  const stop = async () => {
    if (!agentName) return
    setIsLoading(true)
    try {
      const stopped = await callAgentAction('stop_agent', agentName)
      setStatus(stopped.status === 'error' ? stopped : { status: 'stopped' })
    } finally {
      setIsLoading(false)
    }
  }

  return { status, isLoading, start, stop, refresh }
}
