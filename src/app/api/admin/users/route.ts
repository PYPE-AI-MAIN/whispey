// src/app/api/admin/users/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - Fetch all users
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is SUPERADMIN
    const { data: currentUser } = await supabase
      .from('pype_voice_users')
      .select('roles')
      .eq('clerk_id', userId)
      .single()

    if (!currentUser || currentUser.roles?.type !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden - SUPERADMIN only' }, { status: 403 })
    }

    // Get search and filter params
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || 'all'

    // Fetch all users
    let query = supabase
      .from('pype_voice_users')
      .select('clerk_id, email, first_name, last_name, roles, profile_image_url, created_at')
      .order('created_at', { ascending: false })

    // Apply role filter
    if (roleFilter !== 'all') {
      query = query.eq('roles->>type', roleFilter)
    }

    // Apply search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
    }

    const { data: users, error } = await query

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Get project counts for each user
    const usersWithProjects = await Promise.all(
      users.map(async (user) => {
        const { count } = await supabase
          .from('pype_voice_email_project_mapping')
          .select('*', { count: 'exact', head: true })
          .eq('clerk_id', user.clerk_id)
          .or('is_active.is.null,is_active.eq.true')

        return {
          ...user,
          project_count: count || 0
        }
      })
    )

    return NextResponse.json({ users: usersWithProjects }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update user role
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is SUPERADMIN
    const { data: currentUser } = await supabase
      .from('pype_voice_users')
      .select('roles')
      .eq('clerk_id', userId)
      .single()

    if (!currentUser || currentUser.roles?.type !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden - SUPERADMIN only' }, { status: 403 })
    }

    const body = await request.json()
    const { target_user_id, new_role } = body

    if (!target_user_id || !new_role) {
      return NextResponse.json(
        { error: 'target_user_id and new_role are required' },
        { status: 400 }
      )
    }

    // Validate new_role
    if (!['USER', 'BETA'].includes(new_role)) {
      return NextResponse.json(
        { error: 'Invalid role. Only USER and BETA are allowed' },
        { status: 400 }
      )
    }

    // Get role level
    const roleLevel = new_role === 'BETA' ? 2 : 1

    // Update user role
    const { data: updatedUser, error } = await supabase
      .from('pype_voice_users')
      .update({
        roles: {
          type: new_role,
          level: roleLevel,
          metadata: {},
          permissions: []
        }
      })
      .eq('clerk_id', target_user_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating user role:', error)
      return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
    }

    console.log(`✅ User role updated: ${target_user_id} → ${new_role}`)

    return NextResponse.json({ 
      message: 'User role updated successfully',
      user: updatedUser
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error updating user role:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}