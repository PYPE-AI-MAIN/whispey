// Project by ID API - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { jsonFileService } from '@/lib/jsonFileService.server'
import crypto from 'crypto'

// Generate a secure API token
function generateApiToken(): string {
  const randomBytes = crypto.randomBytes(32).toString('hex')
  return `pype_${randomBytes}`
}

// Hash a token using SHA-256
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Get project from JSON file service
    const project = jsonFileService.getProjectById(id)
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check if user has access to this project
    if (project.owner_clerk_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json(project, { status: 200 })

  } catch (error) {
    console.error('Unexpected error fetching project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Check if project exists and user has access
    const existingProject = jsonFileService.getProjectById(id)
    if (!existingProject) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (existingProject.owner_clerk_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Update project using JSON file service
    const updatedProject = jsonFileService.updateProject(id, body)
    
    if (!updatedProject) {
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      )
    }

    console.log(`Successfully updated project with ID: ${id}`)
    return NextResponse.json(updatedProject, { status: 200 })

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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Check if project exists and user has access
    const existingProject = jsonFileService.getProjectById(id)
    if (!existingProject) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (existingProject.owner_clerk_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Delete project using JSON file service
    const success = jsonFileService.deleteProject(id)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      )
    }

    console.log(`Successfully deleted project with ID: ${id}`)
    return NextResponse.json(
      { success: true, message: 'Project deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error deleting project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}