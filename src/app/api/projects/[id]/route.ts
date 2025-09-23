// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { createProjectApiKey } from '@/lib/api-key-management'

// Create Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { action } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (action === 'regenerate_token') {
      // Generate new API token
      const newApiToken = generateApiToken()
      const newHashedToken = hashToken(newApiToken)

      // Update the project with the new hashed token
      const { data, error } = await supabase
        .from('pype_voice_projects')
        .update({ token_hash: newHashedToken })
        .eq('id', projectId)
        .select('*')
        .single()

      if (error) {
        console.error('Error regenerating project token:', error)
        return NextResponse.json(
          { error: 'Failed to regenerate token' },
          { status: 500 }
        )
      }

      // Also store/update in new table (dual storage for regeneration)
      try {
        // Get the user who is regenerating
        const { userId } = await auth()
        
        if (userId) {
          const result = await createProjectApiKey(projectId, userId, newApiToken)
          if (result.success) {
            console.log(`✅ Regenerated key also stored in new table with ID: ${result.id}`)
          } else {
            console.error('⚠️ Failed to store regenerated key in new table:', result.error)
          }
        } else {
          console.warn('⚠️ No user ID available for regenerated key storage in new table')
        }
      } catch (error) {
        console.error('⚠️ Error storing regenerated key in new table:', error)
        // Continue - the old system still works
      }

      // Return project data with the new unhashed token
      const response = {
        ...data,
        api_token: newApiToken // Include the unhashed token for display
      }

      console.log(`Successfully regenerated token for project "${data.name}"`)
      return NextResponse.json(response, { status: 200 })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { retry_configuration } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Validate retry_configuration if provided
    if (retry_configuration) {
      const validCodes = ['408', '480', '486', '504', '600']
      for (const [code, minutes] of Object.entries(retry_configuration)) {
        if (!validCodes.includes(code)) {
          return NextResponse.json(
            { error: `Invalid SIP code: ${code}` },
            { status: 400 }
          )
        }
        if (typeof minutes !== 'number' || minutes < 1 || minutes > 1440) {
          return NextResponse.json(
            { error: `Invalid retry minutes for ${code}: must be between 1 and 1440` },
            { status: 400 }
          )
        }
      }
    }

    // Update the project with retry configuration
    const { data, error } = await supabase
      .from('pype_voice_projects')
      .update({ retry_configuration })
      .eq('id', projectId)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating project:', error)
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      )
    }

    console.log(`Successfully updated retry configuration for project "${data.name}"`)
    return NextResponse.json(data, { status: 200 })

  } catch (error) {
    console.error('Unexpected error updating project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Start cascade deletion process
    console.log(`Starting cascade delete for project: ${projectId}`)

    // 1. Get all agents for this project first
    const { data: agents, error: agentsError } = await supabase
      .from('pype_voice_agents')
      .select('id')
      .eq('project_id', projectId)

    if (agentsError) {
      console.error('Error fetching agents:', agentsError)
      return NextResponse.json(
        { error: 'Failed to fetch project agents' },
        { status: 500 }
      )
    }

    const agentIds = agents?.map((agent: { id: string }) => agent.id) || []
    console.log(`Found ${agentIds.length} agents to clean up`)

    // 2. Delete call logs for all agents in this project
    if (agentIds.length > 0) {
      const { error: callLogsError } = await supabase
        .from('pype_voice_call_logs')
        .delete()
        .in('agent_id', agentIds)

      if (callLogsError) {
        console.error('Error deleting call logs:', callLogsError)
        return NextResponse.json(
          { error: 'Failed to delete call logs' },
          { status: 500 }
        )
      }
      console.log('Successfully deleted call logs')

      // 3. Delete metrics logs (adjust based on your schema relationships)
      const { error: metricsError } = await supabase
        .from('pype_voice_metrics_logs')
        .delete()
        .in('session_id', agentIds) // Adjust this field based on your actual schema

      // Don't fail if metrics logs have different relationships
      if (metricsError) {
        console.warn('Warning: Could not delete metrics logs:', metricsError)
      } else {
        console.log('Successfully deleted metrics logs')
      }
    }

    console.log('Successfully deleted auth tokens')

    // 5. Delete all agents for this project
    const { error: agentsDeleteError } = await supabase
      .from('pype_voice_agents')
      .delete()
      .eq('project_id', projectId)

    if (agentsDeleteError) {
      console.error('Error deleting agents:', agentsDeleteError)
      return NextResponse.json(
        { error: 'Failed to delete agents' },
        { status: 500 }
      )
    }
    console.log('Successfully deleted agents')

    // 6. Finally, delete the project itself (CASCADE will handle pype_voice_api_keys)
    const { error: projectError } = await supabase
      .from('pype_voice_projects')
      .delete()
      .eq('id', projectId)

    if (projectError) {
      console.error('Error deleting project:', projectError)
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      )
    }
    
    console.log(`Successfully deleted project: ${projectId}`)

    return NextResponse.json(
      { 
        message: 'Project and all related data deleted successfully'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error during project deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}