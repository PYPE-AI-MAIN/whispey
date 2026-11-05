import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'

export const runtime = 'nodejs'

/** For the "data before this date lives elsewhere" banner: when this project's call data moved off Pype, or null. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!(await getProjectRoleForApi(id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ since: await getRegistryStore().callDataSince(id) })
}
