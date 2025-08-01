import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params:any }
) {
  try {
    const { userId } = await auth()
    const user = await currentUser()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = params.id // UUID, no parseInt()

    console.log("projectId",projectId)

    const body = await request.json()
    const { email, role = 'member' } = body

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const userEmail = user?.emailAddresses?.[0]?.emailAddress


    console.log("userEmail", userEmail)
    // Check current user access to project
    const { data: userProject } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('role')
      .eq('email', userEmail)
      .eq('project_id', projectId)
      .single()
      

    let hasAdminAccess = false

    console.log("userProjects", userProject)

    if (userProject && ['admin', 'owner'].includes(userProject.role)) {
      hasAdminAccess = true
    } 

    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: 'Admin access required to add members' },
        { status: 403 }
      )
    }

    // Check if already added by email
    const { data: existingMapping } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('id')
      .eq('email', email.trim())
      .eq('project_id', projectId)
      .single()

    if (existingMapping) {
      return NextResponse.json({ error: 'Email already added to project' }, { status: 400 })
    }

    // Check if user already exists in users table
    const { data: existingUser } = await supabase
      .from('pype_voice_users')
      .select('clerk_id')
      .eq('email', email.trim())
      .single()

    const permissions = getPermissionsByRole(role)

    if (existingUser?.clerk_id) {
      // If the user exists, check if they’re already mapped
      const { data: existingUserProject } = await supabase
        .from('pype_voice_email_project_mapping')
        .select('id')
        .eq('clerk_id', existingUser.clerk_id)
        .eq('project_id', projectId)
        .single()

      if (existingUserProject) {
        return NextResponse.json(
          { error: 'User is already a member of this project' },
          { status: 400 }
        )
      }

      // Insert mapping using clerk_id
      const { data: newMapping, error } = await supabase
        .from('pype_voice_email_project_mapping')
        .insert({
          clerk_id: existingUser.clerk_id,
          email: email.trim(),
          project_id: projectId,
          role,
          permissions,
          added_by_clerk_id: userId,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error(error)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }

      return NextResponse.json({ message: 'User added to project', member: newMapping }, { status: 201 })
    } else {
      // Create pending email-based invite
      const { data: mapping, error } = await supabase
        .from('pype_voice_email_project_mapping')
        .insert({
          email: email.trim(),
          project_id: projectId,
          role,
          permissions,
          added_by_clerk_id: userId,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error('Insert error:', error)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }

      return NextResponse.json(
        {
          message: 'Email added to project successfully. User will be added when they sign up.',
          member: mapping,
          type: 'email_mapping'
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
  context: any
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { params } = await context;

    const projectId = params.id

    const { data: accessCheck,error:accessError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('id')
      .eq('clerk_id', userId)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .single()
    

    if(accessError)
    {
      console.error("Access error:", accessError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!accessCheck) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }


    const { data: members, error } = await supabase
    .from('pype_voice_email_project_mapping')
    .select(`
      id,
      clerk_id,
      email,
      role,
      permissions,
      is_active,
      added_by_clerk_id,
      user:pype_voice_users!fk_mail_id(*)
    `)
    .eq('project_id', projectId)
    .eq('is_active', true)
  
    console.log("error",error)

    console.log("members", members)

    return NextResponse.json({ members: members || [] }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error fetching members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getPermissionsByRole(role: string): Record<string, boolean> {
  const rolePermissions: Record<string, Record<string, boolean>> = {
    viewer: { read: true, write: false, delete: false, admin: false },
    member: { read: true, write: true, delete: false, admin: false },
    admin: { read: true, write: true, delete: true, admin: false },
    owner: { read: true, write: true, delete: true, admin: true },
  }

  return rolePermissions[role] || rolePermissions['member']
}
