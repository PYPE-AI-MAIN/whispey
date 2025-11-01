// src/app/api/admin/projects/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - Fetch all projects
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ✅ Verify user is SUPERADMIN using new check-access pattern
    const { data: currentUser } = await supabase
      .from('pype_voice_users')
      .select('roles')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (!currentUser || currentUser.roles?.type !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden - SUPERADMIN only' }, { status: 403 })
    }

    // Get search and filter params
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const planFilter = searchParams.get('plan') || 'all'

    // Fetch all projects
    let query = supabase
      .from('pype_voice_projects')
      .select('id, name, agent, plans, created_at')
      .order('created_at', { ascending: false })

    // Apply plan filter
    if (planFilter !== 'all') {
      query = query.eq('plans->>type', planFilter)
    }

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data: projects, error } = await query

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    // Get member counts and owner info for each project
    const projectsWithDetails = await Promise.all(
      projects.map(async (project) => {
        // Get member count
        const { count: memberCount } = await supabase
          .from('pype_voice_email_project_mapping')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .or('is_active.is.null,is_active.eq.true')

        // Get owner info
        const { data: ownerMapping } = await supabase
          .from('pype_voice_email_project_mapping')
          .select('email, clerk_id')
          .eq('project_id', project.id)
          .eq('role', 'owner')
          .or('is_active.is.null,is_active.eq.true')
          .maybeSingle()

        let ownerEmail = ownerMapping?.email || 'Unknown'
        
        // If we have clerk_id, get user details
        if (ownerMapping?.clerk_id) {
          const { data: ownerUser } = await supabase
            .from('pype_voice_users')
            .select('email')
            .eq('clerk_id', ownerMapping.clerk_id)
            .maybeSingle()
          
          if (ownerUser) {
            ownerEmail = ownerUser.email
          }
        }

        return {
          ...project,
          member_count: memberCount || 0,
          owner_email: ownerEmail
        }
      })
    )

    return NextResponse.json({ projects: projectsWithDetails }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error fetching projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update project plan and limits
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ✅ Verify user is SUPERADMIN using new check-access pattern
    const { data: currentUser } = await supabase
      .from('pype_voice_users')
      .select('roles')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (!currentUser || currentUser.roles?.type !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden - SUPERADMIN only' }, { status: 403 })
    }

    const body = await request.json()
    const { project_id, new_plan, max_agents } = body

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    // Validate new_plan if provided
    if (new_plan && !['FREE', 'BETA', 'PAID'].includes(new_plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Only FREE, BETA, and PAID are allowed' },
        { status: 400 }
      )
    }

    // Validate max_agents if provided
    if (max_agents !== undefined && (typeof max_agents !== 'number' || max_agents < 0)) {
      return NextResponse.json(
        { error: 'max_agents must be a positive number' },
        { status: 400 }
      )
    }

    // ✅ Get current project
    const { data: currentProject, error: fetchError } = await supabase
      .from('pype_voice_projects')
      .select('plans, agent')
      .eq('id', project_id)
      .single()

    if (fetchError || !currentProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // ✅ Track if upgrading from FREE to BETA/PAID
    const oldPlan = currentProject.plans?.type
    const isUpgradingFromFree = oldPlan === 'FREE' && new_plan && ['BETA', 'PAID'].includes(new_plan)

    // Prepare update object
    const updates: any = {}

    // Update plan if provided
    if (new_plan) {
      const planLevel = new_plan === 'PAID' ? 3 : new_plan === 'BETA' ? 2 : 1
      updates.plans = {
        type: new_plan,
        level: planLevel,
        metadata: currentProject.plans?.metadata || {},
        permissions: currentProject.plans?.permissions || []
      }
    }

    // Update max_agents if provided
    if (max_agents !== undefined) {
      updates.agent = {
        ...currentProject.agent,
        limits: {
          ...currentProject.agent?.limits,
          max_agents: max_agents
        },
        last_updated: new Date().toISOString()
      }
    }

    // ✅ If upgrading from FREE and max_agents not explicitly set, default to 2
    if (isUpgradingFromFree && max_agents === undefined) {
      updates.agent = {
        ...currentProject.agent,
        limits: {
          ...currentProject.agent?.limits,
          max_agents: 2
        },
        last_updated: new Date().toISOString()
      }
    }

    // Update project
    const { data: updatedProject, error: updateError } = await supabase
      .from('pype_voice_projects')
      .update(updates)
      .eq('id', project_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating project:', updateError)
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    // ✅ If upgrading from FREE → BETA/PAID, auto-grant can_create_agents to owner
    if (isUpgradingFromFree) {
      const { data: ownerMapping, error: ownerError } = await supabase
        .from('pype_voice_email_project_mapping')
        .select('id, permissions')
        .eq('project_id', project_id)
        .eq('role', 'owner')
        .or('is_active.is.null,is_active.eq.true')
        .maybeSingle()

      if (!ownerError && ownerMapping) {
        // ✅ Add can_create_agents to existing permissions
        const updatedPermissions = {
          ...ownerMapping.permissions,
          can_create_agents: true
        }

        const { error: permissionUpdateError } = await supabase
          .from('pype_voice_email_project_mapping')
          .update({ permissions: updatedPermissions })
          .eq('id', ownerMapping.id)

        if (!permissionUpdateError) {
          console.log(`✅ Auto-granted can_create_agents to project owner for project ${project_id}`)
        } else {
          console.error('Error auto-granting permission:', permissionUpdateError)
        }
      }
    }

    console.log(`✅ Project updated: ${project_id} → Plan: ${new_plan || 'unchanged'}, Max Agents: ${max_agents ?? (isUpgradingFromFree ? 2 : 'unchanged')}`)

    return NextResponse.json({ 
      message: 'Project updated successfully',
      project: updatedProject,
      auto_granted_permission: isUpgradingFromFree
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error updating project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}