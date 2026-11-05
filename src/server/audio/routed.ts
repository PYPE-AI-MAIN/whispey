import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { projectIdForAgent, type PlaneSource } from '@/server/data-plane'

const SIGN_TTL_SECONDS = 3600

/** The object key of a recording given as a key or as a stored URL (the path, without the leading slash). */
export function recordingKey(ref: string): string {
  try {
    return new URL(ref).pathname.replace(/^\/+/, '')
  } catch {
    return ref.replace(/^\/+/, '')
  }
}

/**
 * Recordings of a customer-held project are signed by the customer's signer, not
 * by Pype's S3 keys. The caller names the agent (the routing hint); with no hint,
 * or for a project held by Pype, this returns null and the caller keeps today's
 * S3 path. A hint is checked against the caller's access to that project.
 */
export async function signRoutedRecording(
  dp: PlaneSource,
  agentId: string | null | undefined,
  ref: string
): Promise<{ url: string } | NextResponse | null> {
  if (!agentId) return null
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projectId = await projectIdForAgent(agentId)
  if (!projectId || !(await getProjectRoleForApi(projectId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await dp.isCustomerHeld(projectId))) return null
  const plane = await dp.forProject(projectId)
  return { url: await plane.storage.signRecordingUrl(recordingKey(ref), SIGN_TTL_SECONDS) }
}
