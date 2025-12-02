import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get project ID from query parameters
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Get the project's data from pype_voice_projects table
    const { data: projectData, error: projectError } = await supabase
      .from('pype_voice_projects')
      .select('agent, owner_clerk_id')
      .eq('id', projectId)
      .single()

    if (projectError) {
      console.error('Error fetching project data:', projectError)
      return NextResponse.json(
        { error: 'Failed to fetch project data' },
        { status: 500 }
      )
    }

    // Verify the user owns this project
    if (!projectData) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    if (!projectData.agent) {
      // Return empty structure if no agent data exists
      return NextResponse.json({
        usage: { active_count: 0 },
        agents: [],
        limits: { max_agents: 0 },
        last_updated: new Date().toISOString()
      })
    }

    console.log("projectData",projectData.agent)
    // Return the agent data directly as it's already in the correct format
    return NextResponse.json(projectData.agent)

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Optional: Add POST endpoint to update phone numbers
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate the request body
    if (!body.agents || !Array.isArray(body.agents)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    if (!body.project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Verify the user owns this project
    const { data: projectData, error: projectError } = await supabase
      .from('pype_voice_projects')
      .select('owner_clerk_id')
      .eq('id', body.project_id)
      .single()

    if (projectError || !projectData || projectData.owner_clerk_id !== userId) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Update the agent field in the database
    const { error: updateError } = await supabase
      .from('pype_voice_projects')
      .update({
        agent: {
          usage: body.usage || { active_count: body.agents.length },
          agents: body.agents,
          limits: body.limits || { max_agents: 10 },
          last_updated: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', body.project_id)

    if (updateError) {
      console.error('Error updating project data:', updateError)
      return NextResponse.json(
        { error: 'Failed to update phone numbers' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Phone numbers updated successfully'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Optional: Add PUT endpoint to update a specific agent
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { agentId, updates, project_id } = body

    if (!agentId || !updates || !project_id) {
      return NextResponse.json(
        { error: 'Missing agentId, updates, or project_id' },
        { status: 400 }
      )
    }

    // Verify the user owns this project
    const { data: projectData, error: projectError } = await supabase
      .from('pype_voice_projects')
      .select('agent, owner_clerk_id')
      .eq('id', project_id)
      .single()

    if (projectError || !projectData || projectData.owner_clerk_id !== userId) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    if (!projectData.agent) {
      return NextResponse.json(
        { error: 'No agent data found for this project' },
        { status: 404 }
      )
    }

    // Update the specific agent
    const updatedAgents = projectData.agent.agents.map((agent: any) => 
      agent.id === agentId ? { ...agent, ...updates } : agent
    )

    // Update the database
    const { error: updateError } = await supabase
      .from('pype_voice_projects')
      .update({
        agent: {
          ...projectData.agent,
          agents: updatedAgents,
          last_updated: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', project_id)

    if (updateError) {
      console.error('Error updating agent:', updateError)
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Agent updated successfully'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}