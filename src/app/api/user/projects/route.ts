// app/api/user/projects/route.ts - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

function mapProject(
  project: any,
  role: string = 'owner',
  permissions: any = { read: true, write: true, delete: true, admin: true },
  joined_at: string = new Date().toISOString(),
  access_type: string = 'direct'
) {
  return {
    ...project,
    user_role: role,
    permissions,
    joined_at,
    access_type
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

    const userEmail = user.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 })
    }

    // Get projects from file service (filter by owner)
    const mockProjects = jsonFileService.getProjects().filter(p => p.owner_clerk_id === userId)

    // Format projects for frontend - since we're filtering by owner_clerk_id, all are owned projects
    const ownedProjects = mockProjects.map(project => {
      return mapProject(
        project,
        'owner',
        { read: true, write: true, delete: true, admin: true },
        project.created_at,
        'owner'
      )
    })

    // For demo purposes, we'll just return owned projects
    const allProjects = [...ownedProjects]

    const response = {
      projects: allProjects,
      total: allProjects.length,
      owned: ownedProjects.length,
      shared: 0, // No shared projects in this simplified implementation
      pending: 0  // No pending invitations in this simplified implementation
    }

    console.log(`Fetched ${allProjects.length} projects for user ${userId}`)

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Unexpected error fetching user projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}