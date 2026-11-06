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

const KEY_PROJECT = /recordings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i

/**
 * Recordings of a customer-held project are signed by the customer's signer, not
 * by Pype's S3 keys. The project comes from the agent hint when given, else from
 * the key itself (`recordings/<project_uuid>/...`), so a caller that forgets the
 * hint cannot send a customer-held recording to Pype's S3. With neither, or for a
 * project held by Pype, this returns null and the caller keeps today's S3 path.
 * The project is checked against the caller's access, and a key naming another
 * project than the agent's is refused.
 */
export async function signRoutedRecording(
  dp: PlaneSource,
  agentId: string | null | undefined,
  ref: string
): Promise<{ url: string } | NextResponse | null> {
  const keyProject = KEY_PROJECT.exec(ref)?.[1].toLowerCase() ?? null
  if (!agentId && !keyProject) return null
  if (!agentId && !(await dp.isCustomerHeld(keyProject!))) return null
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projectId = agentId ? await projectIdForAgent(agentId) : keyProject
  if (!projectId || !(await getProjectRoleForApi(projectId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (keyProject && keyProject !== projectId.toLowerCase()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await dp.isCustomerHeld(projectId))) return null
  const plane = await dp.forProject(projectId)
  return { url: await plane.storage.signRecordingUrl(recordingKey(ref), SIGN_TTL_SECONDS) }
}
