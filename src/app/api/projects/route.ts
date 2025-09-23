// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { createProjectApiKey } from '@/lib/api-key-management'

// Create Supabase client for server-side operations (use service role for admin operations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
    const userEmail = user.emailAddresses[0]?.emailAddress
    if (userEmail) {
      const { error: mappingError } = await supabase
        .from('pype_voice_email_project_mapping')
        .insert({
          email: userEmail,
          project_id: project.id,
          role: 'owner',
          permissions: {
            read: true,
            write: true,
            delete: true,
            admin: true
          },
          added_by_clerk_id: userId
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

    // Fetch projects linked to user email
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

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    // Return only active projects with user role included
    const activeProjects = projectMappings
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