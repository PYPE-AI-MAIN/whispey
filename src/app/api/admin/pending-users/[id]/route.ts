import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'
import { sendAccountApprovedEmail, sendAccountDeclinedEmail } from '@/lib/sendApprovalEmail'

export const runtime = 'nodejs'

// Same role -> permissions mapping as /api/projects/[id]/members
function getPermissionsByRole(role: string): Record<string, unknown> {
  const perms: Record<string, Record<string, boolean>> = {
    viewer: { read: true, write: false, delete: false, admin: false },
    admin: { read: true, write: true, delete: true, admin: false },
    owner: { read: true, write: true, delete: true, admin: true },
  }
  return perms[role] || perms.viewer
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caller = await currentUser()
  if (!isPlatformAdmin(caller?.emailAddresses?.[0]?.emailAddress)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: targetUserId } = await params
  const body = await request.json()
  const { action, projectId, role = 'viewer' } = body as {
    action: 'approve' | 'decline'
    projectId?: string
    role?: string
  }

  if (!['approve', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (action === 'approve' && !projectId) {
    return NextResponse.json({ error: 'projectId is required to approve' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: target, error: targetError } = await supabase
    .from('pype_voice_users')
    .select('id, email, clerk_id, approval_status')
    .eq('id', targetUserId)
    .single()

  if (targetError || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  // Re-approving/re-declining a previously-declined request is allowed —
  // their clerk_id/account row already exists and is untouched by a decline,
  // so there's nothing to recreate. Only an already-active user is off-limits
  // here (use the members UI to change/revoke org access instead).
  if (!['pending', 'declined'].includes(target.approval_status)) {
    return NextResponse.json({ error: 'User is not pending approval' }, { status: 400 })
  }

  if (action === 'decline') {
    const { error } = await supabase
      .from('pype_voice_users')
      .update({ approval_status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', targetUserId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      await sendAccountDeclinedEmail({ email: target.email })
    } catch (err) {
      console.error('[pending-users] Failed to send decline email:', err)
    }

    return NextResponse.json({ status: 'declined' })
  }

  // action === 'approve'
  const { data: project, error: projectError } = await supabase
    .from('pype_voice_projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const { data: existingMapping } = await supabase
    .from('pype_voice_email_project_mapping')
    .select('id')
    .eq('project_id', projectId)
    .eq('clerk_id', target.clerk_id)
    .maybeSingle()

  if (!existingMapping) {
    const { error: mappingError } = await supabase.from('pype_voice_email_project_mapping').insert({
      clerk_id: target.clerk_id,
      email: target.email,
      project_id: projectId,
      role,
      permissions: getPermissionsByRole(role),
      added_by_clerk_id: userId,
      is_active: true,
      granted_via: 'new_domain',
    })
    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 500 })
  }

  const { error: statusError } = await supabase
    .from('pype_voice_users')
    .update({ approval_status: 'active', updated_at: new Date().toISOString() })
    .eq('id', targetUserId)

  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 })

  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.whispey.xyz').replace(/\/$/, '')
    await sendAccountApprovedEmail({
      email: target.email,
      orgName: project.name,
      appLink: `${appUrl}/${projectId}/agents`,
    })
  } catch (err) {
    console.error('[pending-users] Failed to send approval email:', err)
  }

  return NextResponse.json({ status: 'approved' })
}
