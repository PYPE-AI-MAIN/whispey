// app/api/projects/route.ts - Demo Mode (No Authentication Required!)
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'
import crypto from 'crypto'

// Generate a secure API token
function generateApiToken(): string {
  // Generate a random token with prefix for easy identification
  const randomBytes = crypto.randomBytes(32).toString('hex')
  return `pype_${randomBytes}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // Generate API token for the project
    const apiToken = generateApiToken()

    // Create project using JSON file service (demo mode - no auth needed)
    const newProject = {
      id: `proj_${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || '',
      owner_clerk_id: 'demo_user', // Demo mode
      environment: 'dev',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      user_role: 'owner',
      api_token: apiToken
    }

    const success = jsonFileService.addProject(newProject)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      )
    }

    console.log(`[DEMO MODE] Successfully created project "${name}" with ID ${newProject.id}`)

    // Return project data
    const response = newProject

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
    console.log('[DEMO MODE] Fetching projects without authentication')

    // Get projects from JSON file service (demo mode - return all projects)
    const projects = jsonFileService.getProjects()

    console.log(`[DEMO MODE] Fetched ${projects.length} projects`)

    return NextResponse.json(projects, { status: 200 })

  } catch (error) {
    console.error('Unexpected error fetching projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}