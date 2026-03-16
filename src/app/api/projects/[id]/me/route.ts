// GET current user's role and permissions (including visibility) for the project
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'
import { mergeWithDefaults } from '@/types/visibility'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

    const permissions = (mapping.permissions || {}) as Record<string, unknown>
    const visibility = mergeWithDefaults(permissions.visibility as object | undefined)

    return NextResponse.json({
      role: mapping.role,
      permissions: mapping.permissions,
      visibility,
    }, { status: 200 })
  } catch (err) {
    console.error('Unexpected error in project me:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
