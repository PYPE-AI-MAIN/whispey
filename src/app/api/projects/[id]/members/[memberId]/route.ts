// src/app/api/projects/[id]/members/[memberId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getPermissionsByRole(role: string): Record<string, boolean> {
  const rolePermissions: Record<string, Record<string, boolean>> = {
    viewer: { read: true, write: false, delete: false, admin: false },
    user: { read: true, write: false, delete: false, admin: false },
    member: { read: true, write: true, delete: false, admin: false },
    admin: { read: true, write: true, delete: true, admin: false },
    owner: { read: true, write: true, delete: true, admin: true },
  }

  return rolePermissions[role] || rolePermissions['member']
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

    // Validate role
    const validRoles = ['viewer', 'user', 'member', 'admin', 'owner']
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if current user has admin/owner access
    const { data: allMappings } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('*')
      .eq('project_id', projectId)
      .or('is_active.is.null,is_active.eq.true')

    const userAccess = allMappings?.find(
      (m: any) => m.clerk_id === userId || m.email?.toLowerCase() === userEmail?.toLowerCase()
    )

    if (!userAccess || !['admin', 'owner'].includes(userAccess.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get the member being updated
    const memberToUpdate = allMappings?.find((m: any) => m.id.toString() === memberId)

    if (!memberToUpdate) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Don't allow changing owner role unless you're the owner
    if (memberToUpdate.role === 'owner' && userAccess.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can change owner roles' }, { status: 403 })
    }

    // Don't allow non-owners to assign owner role
    if (role === 'owner' && userAccess.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can assign owner role' }, { status: 403 })
    }

    // Don't allow changing your own role
    if (memberToUpdate.clerk_id === userId || memberToUpdate.email?.toLowerCase() === userEmail?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
    }

    // Update the member's role
    const permissions = getPermissionsByRole(role)
    
    const { data: updatedMember, error: updateError } = await supabase
      .from('pype_voice_email_project_mapping')
      .update({ 
        role,
        permissions 
      })
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

    // ✅ NEW: Get permanent flag from query params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    // Check if current user has admin/owner access
    const { data: allMappings } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('*')
      .eq('project_id', projectId)
      .or('is_active.is.null,is_active.eq.true')

    const userAccess = allMappings?.find(
      (m: any) => m.clerk_id === userId || m.email?.toLowerCase() === userEmail?.toLowerCase()
    )

    if (!userAccess || !['admin', 'owner'].includes(userAccess.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get the member to delete (check ALL records, not just active)
    const { data: memberToDelete, error: fetchError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('*')
      .eq('id', memberId)
      .eq('project_id', projectId)
      .single()

    if (fetchError || !memberToDelete) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (memberToDelete.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove project owner' }, { status: 400 })
    }

    // ✅ NEW: Handle permanent vs soft delete
    if (permanent) {
      // Hard delete - permanently remove from database
      const { error: deleteError } = await supabase
        .from('pype_voice_email_project_mapping')
        .delete()
        .eq('id', memberId)
        .eq('project_id', projectId)

      if (deleteError) {
        console.error('Error permanently deleting member:', deleteError)
        return NextResponse.json({ error: 'Failed to permanently remove member' }, { status: 500 })
      }

      return NextResponse.json({ 
        message: 'Member permanently removed',
        type: 'permanent_delete' 
      }, { status: 200 })
    } else {
      // Soft delete - set is_active to false
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