// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { createProjectApiKey } from '@/lib/api-key-management'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

function generateApiToken(): string {
  const randomBytes = crypto.randomBytes(32).toString('hex')
  return `pype_${randomBytes}`
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, description } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // ✅ STEP 1: Fetch user's role from pype_voice_users
    const { data: userData, error: userError } = await supabase
      .from('pype_voice_users')
      .select('roles')
      .eq('clerk_id', userId)
      .maybeSingle()  // ✅ Changed to maybeSingle

    if (userError) {
      console.error('Error fetching user role:', userError)
      // Don't fail - default to USER if not found
    }

    const userRoleType = userData?.roles?.type || 'USER'
    const isSuperAdmin = userRoleType === 'SUPERADMIN'

    console.log(`Creating project for user ${userId} with role: ${userRoleType}`)

    // ✅ STEP 2: Set project config based on user role
    // SUPERADMIN: Gets 2 agents automatically with BETA/SUPERADMIN plan
    // Regular users: Get FREE plan with 0 agents (must be upgraded by admin)
    const agentConfig = {
      usage: {
        active_count: 0
      },
      agents: [],
      limits: {
        max_agents: isSuperAdmin ? 2 : 0
      },
      last_updated: new Date().toISOString()
    }

    const plansConfig = {
      type: isSuperAdmin ? 'BETA' : 'FREE',  // ✅ Changed SUPERADMIN → BETA
      level: isSuperAdmin ? 2 : 1,
      metadata: {},
      permissions: []
    }

    // Generate API token
    const apiToken = generateApiToken()
    const hashedToken = hashToken(apiToken)

    const projectData = {
      name: name.trim(),
      description: description?.trim() || null,
      environment: 'dev',
      is_active: true,
      retry_configuration: {},
      token_hash: hashedToken,
      owner_clerk_id: userId,
      agent: agentConfig,
      plans: plansConfig
    }

    const { data: project, error: projectError } = await supabase
      .from('pype_voice_projects')
      .insert([projectData])
      .select('*')
      .single()

    if (projectError) {
      console.error('Error creating project:', projectError)
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully created project "${project.name}" with ID ${project.id}`)
    console.log(`   Plan: ${plansConfig.type}, Max Agents: ${agentConfig.limits.max_agents}`)

    // Store in new table as well (dual storage)
    try {
      const result = await createProjectApiKey(project.id, userId, apiToken)
      if (result.success) {
        console.log(`✅ API key also stored in new table with ID: ${result.id}`)
      } else {
        console.error('⚠️ Failed to store in new table:', result.error)
      }
    } catch (error) {
      console.error('⚠️ Error storing API key in new table:', error)
    }

    // ✅ STEP 3: Add creator to email_project_mapping as owner
    const userEmail = user.emailAddresses[0]?.emailAddress
    if (userEmail) {
      // ✅ NEW: Determine if owner should have can_create_agents permission
      // SUPERADMIN: YES (project is BETA with 2 agents)
      // Regular user: NO (project is FREE with 0 agents)
      const canCreateAgents = isSuperAdmin

      const { error: mappingError } = await supabase
        .from('pype_voice_email_project_mapping')
        .insert({
          clerk_id: userId,
          email: userEmail,
          project_id: project.id,
          role: 'owner',
          permissions: {
            read: true,
            write: true,
            delete: true,
            admin: true,
            can_create_agents: canCreateAgents  // ✅ NEW: Set based on user role
          },
          added_by_clerk_id: userId,
          is_active: true
        })

      if (mappingError) {
        console.error('Error adding creator to email mapping:', mappingError)
      } else {
        console.log(`✅ Added creator ${userEmail} to email mapping for project ${project.id}`)
        console.log(`   can_create_agents: ${canCreateAgents}`)
      }
    }

    const response = {
      ...project,
      api_token: apiToken
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error('Unexpected error creating project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET function remains the same
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userEmail = user.emailAddresses[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    const { data: projectMappings, error } = await supabase
      .from('pype_voice_email_project_mapping')
      .select(`
        project:pype_voice_projects (
          id,
          name,
          description,
          environment,
          is_active,
          owner_clerk_id,
          created_at
        ),
        role
      `)
      .eq('email', userEmail)
      .or('is_active.is.null,is_active.eq.true')

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    const activeProjects = projectMappings
      .filter(mapping => mapping.project)
      .map(mapping => ({
        ...mapping.project,
        user_role: mapping.role
      }))

    return NextResponse.json(activeProjects, { status: 200 })

  } catch (error) {
    console.error('Unexpected error fetching projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}