// app/api/agents/route.ts - Demo Mode (No Authentication Required!)
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, agent_type, configuration, project_id, environment } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      )
    }

    if (!agent_type) {
      return NextResponse.json(
        { error: 'Agent type is required' },
        { status: 400 }
      )
    }

    if (!project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Verify project exists in JSON file service (demo mode)
    const project = jsonFileService.getProjectById(project_id)
    if (!project) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Create agent using JSON file service
    const newAgent = {
      id: `agent_${Date.now()}`,
      name: name.trim(),
      agent_type,
      configuration: configuration || {},
      project_id,
      environment: environment || 'dev',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      field_extractor: false,
      field_extractor_keys: []
    }

    const success = jsonFileService.addAgent(newAgent)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to create agent' },
        { status: 500 }
      )
    }

    console.log(`[DEMO MODE] Successfully created agent "${name}" with ID ${newAgent.id}`)

    // Format response to match frontend expectations
    const response = newAgent

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error('Unexpected error creating agent:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const project_id = searchParams.get('project_id')

    if (!project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Get agents for the project from JSON file service
    const agents = jsonFileService.getAgents(project_id)

    console.log(`[DEMO MODE] Fetched ${agents.length} agents for project ${project_id}`)

    return NextResponse.json(agents, { status: 200 })

  } catch (error) {
    console.error('Unexpected error fetching agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}