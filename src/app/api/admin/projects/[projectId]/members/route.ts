// src/app/api/admin/projects/[projectId]/members/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ✅ Check if user is SUPERADMIN
    const { data: userData } = await supabase
      .from('pype_voice_users')
      .select('roles')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (!userData || userData.roles?.type !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
    }

    const { projectId } = await params

    // ✅ Fetch all project members (including pending invites)
    const { data: members, error: membersError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    return NextResponse.json({ 
      members: members || []
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ✅ Check if user is SUPERADMIN
    const { data: userData } = await supabase
      .from('pype_voice_users')
      .select('roles')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (!userData || userData.roles?.type !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
    }

    const { projectId } = await params
    const body = await request.json()
    const { member_id, can_create_agents } = body

    if (!member_id || typeof can_create_agents !== 'boolean') {
      return NextResponse.json({ 
        error: 'member_id and can_create_agents are required' 
      }, { status: 400 })
    }

    // ✅ Get current member
    const { data: member, error: fetchError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('permissions, role')
      .eq('id', member_id)
      .eq('project_id', projectId)
      .single()

    if (fetchError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // ✅ Update can_create_agents permission
    const updatedPermissions = {
      ...member.permissions,
      can_create_agents
    }

    const { error: updateError } = await supabase
      .from('pype_voice_email_project_mapping')
      .update({ permissions: updatedPermissions })
      .eq('id', member_id)
      .eq('project_id', projectId)

    if (updateError) {
      console.error('Error updating permission:', updateError)
      return NextResponse.json({ error: 'Failed to update permission' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Permission updated successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}