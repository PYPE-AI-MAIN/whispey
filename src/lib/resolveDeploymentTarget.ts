import { auth } from '@clerk/nextjs/server'
import { getCallerGlobalRole } from '@/lib/prod-auth'
import type { DeploymentTarget } from '@/lib/pypeApiFetch'

/**
 * Resolves the deployment target a caller requested, downgrading to 'classic'
 * unless the caller is a superadmin. The client-side toggle is trusted state
 * that could be bypassed, so this re-check is the actual enforcement point.
 */
export async function resolveDeploymentTarget(requestedTarget: unknown): Promise<DeploymentTarget> {
  if (requestedTarget !== 'docker') return 'classic'

  const { userId } = await auth()
  const callerRole = userId ? await getCallerGlobalRole(userId) : 'user'
  return callerRole === 'superadmin' ? 'docker' : 'classic'
}
