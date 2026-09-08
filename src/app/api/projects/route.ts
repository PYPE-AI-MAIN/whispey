// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { createProjectApiKey } from '@/lib/api-key-management'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'
import { projectMembershipMatch } from '@/lib/getProjectRoleForApi'

// Create Supabase client for server-side operations (use service role for admin operations)
const supabase = createServiceRoleClient()

// Generate a secure API token
function generateApiToken(): string {
  // Generate a random token with prefix for easy identification
  const randomBytes = crypto.randomBytes(32).toString('hex')
  return `pype_${randomBytes}`
}

// Hash a token using SHA-256
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current user details
    const user = await currentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Self-serve org creation is open to any authenticated caller. No extra
    // role check is needed here: middleware.ts already blocks a pending or
    // declined account from reaching any route but /pending-approval, so by
    // the time a request lands here the caller is either approved or a
    // platform admin. This is the path /onboarding's "Create Organization"
    // uses for a brand-new user with no prior project to inherit — see
    // pendingUserActions.ts's copyExistingProjectAccess for the other case
    // (an approved user who already had access via an old-domain account).
    const userEmail = user.emailAddresses[0]?.emailAddress

    const body = await request.json()
    const { name, description } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // Generate API token
    const apiToken = generateApiToken()
    const hashedToken = hashToken(apiToken)

    const projectData = {
      name: name.trim(),
      description: description?.trim() || null,
      environment: 'dev', // Default environment
      is_active: true,
      retry_configuration: {},
      token_hash: hashedToken,
      owner_clerk_id: userId // Add owner reference
    }

    // Start a transaction-like approach
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

    console.log(`Successfully created project "${project.name}" with ID ${project.id}`)

    // Store in new table as well (dual storage)
    try {
      const result = await createProjectApiKey(project.id, userId, apiToken)
      if (result.success) {
        console.log(`✅ API key also stored in new table with ID: ${result.id}`)
      } else {
        console.error('⚠️ Failed to store in new table:', result.error)
        // Don't fail the whole operation, just log the warning
      }
    } catch (error) {
      console.error('⚠️ Error storing API key in new table:', error)
      // Continue - the old system still works
    }

    // Add creator to email_project_mapping as owner
    if (userEmail) {
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
            admin: true
          },
          added_by_clerk_id: userId,
          is_active: true,
          granted_via: 'new_domain'
        })

      if (mappingError) {
        console.error('Error adding creator to email mapping:', mappingError)
        // Don't fail the whole operation, just log the error
        // The user will still be added via the webhook when they sign up
      } else {
        console.log(`Added creator ${userEmail} to email mapping for project ${project.id}`)
      }
    }

    // Return project data with the unhashed token
    const response = {
      ...project,
      api_token: apiToken // Include the unhashed token for display
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

    // Fetch projects this login has access to. Regular users only match their
    // own clerk_id, or an unclaimed invite created by the new-domain approval
    // flow — not every old row that merely shares this email (see
    // getProjectRoleForApi.ts for why).
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
      .or(projectMembershipMatch(userId, userEmail, isPlatformAdmin(userEmail)))
      .or('is_active.is.null,is_active.eq.true')

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    // Return only active projects with user role included — deduped by
    // project id, since an admin's deliberately broad match (clerk_id OR
    // email) can legitimately return more than one mapping row for the same
    // project (e.g. one per old/new-domain account sharing this email).
    const seenProjectIds = new Set<string>()
    const activeProjects = projectMappings
      .filter(mapping => mapping.project)
      .filter(mapping => {
        // Supabase's inferred type for this joined relation doesn't match
        // its actual one-to-one shape at runtime (same quirk as elsewhere
        // in this codebase) — hence the `any`.
        const id = (mapping.project as any)?.id
        if (seenProjectIds.has(id)) return false
        seenProjectIds.add(id)
        return true
      })
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