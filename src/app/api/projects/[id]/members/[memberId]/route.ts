// src/app/api/projects/[id]/members/[memberId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { DEFAULT_MEMBER_VISIBILITY, VIEWER_RESTRICTED_VISIBILITY } from '@/types/visibility'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

function normalizeRole(role: string): string {
  if (role === 'user' || role === 'member' || role === 'viewer') return 'viewer'
  return role
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { userId } = await auth()
    const user = await currentUser()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, memberId } = await params
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    const body = await request.json()
    const { role } = body

    // Require role for updates (visibility is managed by backend based on role)
    if (!role) {
      return NextResponse.json({ error: 'Provide role' }, { status: 400 })
    }

    const validRoles = ['viewer', 'admin', 'owner']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // ✅ FIXED: Check if current user has admin/owner access (only active mappings)
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

    if (!userAccessMapping || !['admin', 'owner'].includes(userAccessMapping.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Normalize the role early
    const newRole = normalizeRole(role)

    // ✅ FIXED: Get the member being updated (check only active members for role changes)
    const { data: memberToUpdate, error: memberError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('*')
      .eq('id', memberId)
      .eq('project_id', projectId)
      .or('is_active.is.null,is_active.eq.true')
      .maybeSingle()

    if (memberError) {
      console.error('Error fetching member:', memberError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!memberToUpdate) {
      return NextResponse.json({ error: 'Active member not found' }, { status: 404 })
    }

    // Don't allow changing owner role unless you're the owner
    if (memberToUpdate.role === 'owner' && userAccessMapping.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can change owner roles' }, { status: 403 })
    }

    // Don't allow non-owners to assign owner role
    if (newRole === 'owner' && userAccessMapping.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can assign owner role' }, { status: 403 })
    }

    // Don't allow changing your own role (but allow changing own visibility for future use)
    const isSelf = memberToUpdate.clerk_id === userId || memberToUpdate.email?.toLowerCase() === userEmail?.toLowerCase()
    if (role && isSelf) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
    }

    // Determine permissions based on role (visibility is fixed per role)
    const getPermissionsForRole = (r: string) => {
      const normalized = normalizeRole(r)
      const base = {
        read: true,
        write: normalized === 'admin' || normalized === 'owner',
        delete: normalized === 'admin' || normalized === 'owner',
        admin: normalized === 'owner',
      }

      return {
        ...base,
        visibility: normalized === 'viewer' ? VIEWER_RESTRICTED_VISIBILITY : DEFAULT_MEMBER_VISIBILITY,
      }
    }

    const permissions = getPermissionsForRole(newRole)

    const { data: updatedMember, error: updateError } = await supabase
      .from('pype_voice_email_project_mapping')
      .update({ role: newRole, permissions })
      .eq('id', memberId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating member role:', updateError)
      return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Member role updated successfully',
      member: updatedMember 
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error updating member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { userId } = await auth()
    const user = await currentUser()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, memberId } = await params
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    // Get permanent flag from query params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    // ✅ FIXED: Check if current user has admin/owner access (only active mappings)
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

    if (!userAccessMapping || !['admin', 'owner'].includes(userAccessMapping.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // ✅ FIXED: Get the member to delete (check ALL records, not just active)
    const { data: memberToDelete, error: fetchError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('*')
      .eq('id', memberId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (fetchError) {
      console.error('Error fetching member to delete:', fetchError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!memberToDelete) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (memberToDelete.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove project owner' }, { status: 400 })
    }

    // Don't allow removing yourself
    if (memberToDelete.clerk_id === userId || memberToDelete.email?.toLowerCase() === userEmail?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })
    }

    // Pending invites (no clerk_id) are always hard deleted
    // so the invite token is permanently invalidated and the old link stops working.
    // Active members (with clerk_id) are soft deleted so they can be re-added later.
    const isPendingInvite = !memberToDelete.clerk_id

    if (isPendingInvite || permanent) {
      const { error: deleteError } = await supabase
        .from('pype_voice_email_project_mapping')
        .delete()
        .eq('id', memberId)
        .eq('project_id', projectId)

      if (deleteError) {
        console.error('Error deleting member:', deleteError)
        return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
      }

      return NextResponse.json({ 
        message: isPendingInvite ? 'Invite cancelled' : 'Member permanently removed',
        type: isPendingInvite ? 'invite_cancelled' : 'permanent_delete',
      }, { status: 200 })
    } else {
      // Soft delete active members — preserves history and allows re-adding
      const { error: deleteError } = await supabase
        .from('pype_voice_email_project_mapping')
        .update({ is_active: false })
        .eq('id', memberId)
        .eq('project_id', projectId)

      if (deleteError) {
        console.error('Error soft deleting member:', deleteError)
        return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
      }

      return NextResponse.json({ 
        message: 'Member access removed',
        type: 'soft_delete'
      }, { status: 200 })
    }
  } catch (error) {
    console.error('Unexpected error removing member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}