// Project Members API - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { MockDataService } from '@/lib/mockData'

export async function POST(
  request: NextRequest,
  { params }: { params: any }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { params: routeParams } = await params
    const projectId = routeParams.id
    const body = await request.json()

    const { email, role = 'viewer', permissions = {} } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Check if project exists and user has access
    const project = MockDataService.getProjectById(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.owner_clerk_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Mock: simulate adding member (in real app, this would add to database)
    const mockMember = {
      id: `member_${Date.now()}`,
      email,
      role,
      permissions,
      project_id: projectId,
      added_by_clerk_id: userId,
      created_at: new Date().toISOString(),
      is_active: true
    }

    console.log(`Mock: Added member ${email} to project ${projectId}`)
    return NextResponse.json(mockMember, { status: 201 })

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

    const { params } = await context
    const projectId = params.id

    // Check if project exists and user has access
    const project = MockDataService.getProjectById(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.owner_clerk_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Mock: return demo members
    const mockMembers = [
      {
        id: 'member_1',
        clerk_id: userId,
        email: 'demo@example.com',
        role: 'owner',
        permissions: { read: true, write: true, delete: true, admin: true },
        is_active: true,
        added_by_clerk_id: userId,
        user: {
          id: 'user_1',
          clerk_id: userId,
          email: 'demo@example.com',
          first_name: 'Demo',
          last_name: 'User',
          profile_image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true
        }
      }
    ]

    return NextResponse.json({ members: mockMembers }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error fetching members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getPermissionsByRole(role: string): Record<string, boolean> {
  const rolePermissions: Record<string, Record<string, boolean>> = {
    viewer: { read: true, write: false, delete: false, admin: false },
    editor: { read: true, write: true, delete: false, admin: false },
    admin: { read: true, write: true, delete: true, admin: true },
  }
  
  return rolePermissions[role] || rolePermissions.viewer
}