// GET current user's role and effective visibility for the project.
// Reads pype_voice_email_project_mapping.permissions (single column); visibility = permissions.visibility.
// Merges with role defaults via getEffectiveVisibility(). Frontend shows only what visibility allows.
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getEffectiveVisibility } from '@/types/visibility'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const user = await currentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    const { data: mapping, error } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('role, permissions, is_active')
      .eq('project_id', projectId)
      .or(`clerk_id.eq.${userId},email.ilike.${userEmail}`)
      .or('is_active.is.null,is_active.eq.true')
      .maybeSingle()

    if (error) {
      console.error('Error fetching project me:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!mapping) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    }

    const role = ['user', 'member', 'viewer'].includes(mapping.role) ? 'viewer' : mapping.role
    const storedVisibility = (mapping.permissions as { visibility?: import('@/types/visibility').MemberVisibility } | null)?.visibility
    const visibility = getEffectiveVisibility(role, storedVisibility)

    return NextResponse.json({
      role,
      permissions: { ...mapping.permissions, visibility },
      visibility,
    }, { status: 200 })
  } catch (err) {
    console.error('Unexpected error in project me:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
