import { useCallback, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import toast from 'react-hot-toast'
import { deployable } from '@/lib/workflow/globalRules'
import { useWorkflowStore } from '@/stores/workflowStore'

type Options = { backendAgentName: string; agentId: string; onDeployed: () => void }

/**
 * Deploy the workflow to the voice backend, then save it as a numbered version with the message the person typed.
 * Every agent runs on the shared worker pool, which re-reads the stored config on each call, so a deployed
 * agent is live immediately — there is nothing to start.
 */
export function useWorkflowDeploy({ backendAgentName, agentId, onDeployed }: Options) {
  const { user } = useUser()
  const [deploying, setDeploying] = useState(false)

  const saveVersion = useCallback(
    async (message: string) => {
      const workflow = useWorkflowStore.getState().workflow
      const res = await fetch(`/api/agents/${agentId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Kept in our database only: the snapshot can hold API headers, which must not be pushed to GitHub.
        body: JSON.stringify({
          config: { workflow },
          commit_message: message,
          userEmail: user?.primaryEmailAddress?.emailAddress,
          userId: user?.id,
          skipGithub: true,
        }),
      })
      if (!res.ok) toast.error('Deployed, but this version could not be saved to the history')
    },
    [agentId, user]
  )

  const deploy = useCallback(
    async (message: string): Promise<boolean> => {
      const workflow = useWorkflowStore.getState().workflow
      if (!workflow || !backendAgentName) return false
      setDeploying(true)
      try {
        const res = await fetch(`/api/workflow/${encodeURIComponent(backendAgentName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflow: deployable(workflow) }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(data?.message || `Deploy failed (${res.status})`)
          return false
        }
        toast.success('Workflow deployed')
        if (data?.warning) toast.error(data.warning, { duration: 8000 })
        useWorkflowStore.getState().markClean()
        onDeployed()
        await saveVersion(message)
        return true
      } catch {
        toast.error('Could not reach the deploy endpoint')
        return false
      } finally {
        setDeploying(false)
      }
    },
    [backendAgentName, onDeployed, saveVersion]
  )

  return { deploying, deploy }
}
