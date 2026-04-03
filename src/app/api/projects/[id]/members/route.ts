// src/app/api/projects/[id]/members/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { randomUUID } from 'crypto'
import { DEFAULT_MEMBER_VISIBILITY, VIEWER_RESTRICTED_VISIBILITY } from '@/types/visibility'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { sendInviteEmail } from '@/lib/sendInviteEmail'

const supabase = createServiceRoleClient()

function normalizeRole(role: string): string {
  if (role === 'user' || role === 'member' || role === 'viewer') return 'viewer'
  return role
}

function getPermissionsByRole(role: string): Record<string, unknown> {
  const normalizedRole = normalizeRole(role)

  const rolePermissions: Record<string, Record<string, boolean>> = {
    viewer: { read: true, write: false, delete: false, admin: false },
    admin: { read: true, write: true, delete: true, admin: false },
    owner: { read: true, write: true, delete: true, admin: true },
  }
  const perms = rolePermissions[normalizedRole] || rolePermissions['viewer']

  return {
    ...perms,
    visibility: normalizedRole === 'viewer' ? VIEWER_RESTRICTED_VISIBILITY : DEFAULT_MEMBER_VISIBILITY,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const user = await currentUser()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    const body = await request.json()
    const { email, role = 'viewer' } = body
    const normalizedRole = normalizeRole(role)

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Normalize to lowercase to prevent duplicate entries from casing differences
    const normalizedEmail = email.trim().toLowerCase()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    
    // Check current user access
    const { data: allMappings } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('role, clerk_id, email')
      .eq('project_id', projectId)
      .or('is_active.is.null,is_active.eq.true')

    const userMapping = allMappings?.find(
      (m: any) => m.clerk_id === userId || m.email?.toLowerCase() === userEmail?.toLowerCase()
    )

    if (!userMapping || !['admin', 'owner'].includes(userMapping.role)) {
      return NextResponse.json(
        { error: 'Admin access required to add members' },
        { status: 403 }
      )
    }

    // Fetch project name for invite email
    const { data: project } = await supabase
      .from('pype_voice_projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle()

    const orgName = project?.name ?? 'your organization'
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.whispey.xyz').replace(/\/$/, '')

    // Check if already added by email (INCLUDING INACTIVE ONES)
    const { data: existingMapping, error: existingMappingError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('id, is_active, clerk_id, invite_token')
      .eq('email', normalizedEmail)
      .eq('project_id', projectId)
      .maybeSingle()

    if (existingMappingError) {
      console.error('Error checking existing mapping:', existingMappingError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // If mapping exists and is active, return error
    if (existingMapping && (existingMapping.is_active === true || existingMapping.is_active === null)) {
      return NextResponse.json({ error: 'Email already added to project' }, { status: 400 })
    }

    // If mapping exists but is inactive, reactivate it
    if (existingMapping && existingMapping.is_active === false) {
      const permissions = getPermissionsByRole(normalizedRole)
      const isPending = !existingMapping.clerk_id

      const { data: reactivatedMapping, error: reactivateError } = await supabase
        .from('pype_voice_email_project_mapping')
        .update({
          is_active: true,
          role: normalizedRole,
          permissions,
          added_by_clerk_id: userId,
          // Generate a new token for pending users to invalidate the old invite link
          ...(isPending && {
            invite_token: randomUUID(),
            invite_sent_at: new Date().toISOString(),
          }),
        })
        .eq('id', existingMapping.id)
        .select()
        .single()

      if (reactivateError) {
        console.error('Error reactivating mapping:', reactivateError)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }

      const isExistingUser = !isPending
      const inviteLink = isExistingUser
        ? `${appUrl}/${projectId}/agents`
        : `${appUrl}/invite/${reactivatedMapping.invite_token}`

      let inviteSent = false
      try {
        await sendInviteEmail({ email: normalizedEmail, orgName, inviteLink, isExistingUser })
        inviteSent = true
      } catch (err) {
        console.warn('[invite] User re-added to project, but email could not be sent:', err instanceof Error ? err.message : String(err))
      }

      return NextResponse.json({ 
        message: 'User re-added to project', 
        member: reactivatedMapping,
        type: 'reactivated',
        inviteSent,
      }, { status: 201 })
    }

    // Continue with normal flow to add new member...
    // Check if user already exists in users table
    const { data: existingUser, error: existingUserError } = await supabase
      .from('pype_voice_users')
      .select('clerk_id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingUserError) {
      console.error('Error checking existing user:', existingUserError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const permissions = getPermissionsByRole(normalizedRole)

    if (existingUser?.clerk_id) {
      // User exists - add them directly
      const { data: existingUserProject, error: existingUserProjectError } = await supabase
        .from('pype_voice_email_project_mapping')
        .select('id')
        .eq('clerk_id', existingUser.clerk_id)
        .eq('project_id', projectId)
        .maybeSingle()

      if (existingUserProjectError) {
        console.error('Error checking existing user project:', existingUserProjectError)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }

      if (existingUserProject) {
        return NextResponse.json(
          { error: 'User is already a member of this project' },
          { status: 400 }
        )
      }

      const { data: newMapping, error } = await supabase
        .from('pype_voice_email_project_mapping')
        .insert({
          clerk_id: existingUser.clerk_id,
          email: normalizedEmail,
          project_id: projectId,
          role: normalizedRole,
          permissions,
          added_by_clerk_id: userId,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error('Error inserting new mapping:', error)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }

      let inviteSent = false
      try {
        await sendInviteEmail({
          email: normalizedEmail,
          orgName,
          inviteLink: `${appUrl}/${projectId}/agents`,
          isExistingUser: true,
        })
        inviteSent = true
      } catch (err) {
        console.warn('[invite] User added to project, but email could not be sent:', err instanceof Error ? err.message : String(err))
      }

      return NextResponse.json({ 
        message: 'User added to project', 
        member: newMapping,
        type: 'direct_add',
        inviteSent,
      }, { status: 201 })
    } else {
      // Create pending email-based invite
      const { data: mapping, error } = await supabase
        .from('pype_voice_email_project_mapping')
        .insert({
          email: normalizedEmail,
          project_id: projectId,
          role: normalizedRole,
          permissions,
          added_by_clerk_id: userId,
          is_active: true,
          invite_sent_at: new Date().toISOString(),
          // invite_token auto-generated by DB DEFAULT gen_random_uuid()
        })
        .select()
        .single()

      if (error) {
        console.error('Insert error:', error)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }

      let inviteSent = false
      try {
        await sendInviteEmail({
          email: normalizedEmail,
          orgName,
          inviteLink: `${appUrl}/invite/${mapping.invite_token}`,
          isExistingUser: false,
        })
        inviteSent = true
      } catch (err) {
        console.warn('[invite] User added to pending list, but email could not be sent:', err instanceof Error ? err.message : String(err))
      }

      return NextResponse.json(
        {
          message: 'Invite sent. User will be added when they sign up.',
          member: mapping,
          type: 'email_mapping',
          inviteSent,
        },
        { status: 201 }
      )
    }
  } catch (error) {
    console.error('Unexpected error adding member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
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

    // ✅ FIXED: Check if user has ANY access to the project (not just admin)
    const { data: userAccessMapping, error: accessError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('role, clerk_id, email, is_active')
      .eq('project_id', projectId)
      .or(`clerk_id.eq.${userId},email.ilike.${userEmail}`)
      .or('is_active.is.null,is_active.eq.true')
      .maybeSingle()

    if (accessError) {
      console.error('Error checking user access:', accessError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!userAccessMapping) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // ✅ Everyone can view members, no role restriction here

    // ✅ Now fetch ALL mappings (including inactive) for display
    const { data: allProjectMappings, error: mappingsError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('*')
      .eq('project_id', projectId)

    if (mappingsError) {
      console.error('Error fetching mappings:', mappingsError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Separate members into groups
    // Only show active pending mappings — soft-deleted ones (is_active=false) should not appear
    const membersWithClerkId = allProjectMappings?.filter((m: any) => m.clerk_id) || []
    const pendingMappings = allProjectMappings?.filter((m: any) => !m.clerk_id && m.is_active !== false) || []

    // Get user details for members with clerk_id
    let membersWithDetails: any[] = []
    if (membersWithClerkId.length > 0) {
      const clerkIds = membersWithClerkId.map((m: any) => m.clerk_id)
      
      const { data: users, error: usersError } = await supabase
        .from('pype_voice_users')
        .select('*')
        .in('clerk_id', clerkIds)

      if (usersError) {
        console.error('Error fetching users:', usersError)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }

      // ✅ Combine mapping data with user data - INCLUDE is_active field
      membersWithDetails = membersWithClerkId.map((mapping: any) => {
        const user = users?.find((u: any) => u.clerk_id === mapping.clerk_id)
        return {
          id: mapping.id,
          clerk_id: mapping.clerk_id,
          role: normalizeRole(mapping.role),
          permissions: mapping.permissions,
          is_active: mapping.is_active,
          joined_at: mapping.created_at,
          user: {
            email: user?.email || mapping.email,
            first_name: user?.first_name || null,
            last_name: user?.last_name || null,
            profile_image_url: user?.profile_image_url || null,
          }
        }
      })
    }

    // Format pending mappings
    const formattedPending = pendingMappings.map((mapping: any) => ({
      id: mapping.id,
      email: mapping.email,
      role: normalizeRole(mapping.role),
      permissions: mapping.permissions,
      is_active: mapping.is_active,
      created_at: mapping.created_at,
    }))

    return NextResponse.json({ 
      members: membersWithDetails,
      pending_mappings: formattedPending,
      currentUserRole: normalizeRole(userAccessMapping.role)
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}