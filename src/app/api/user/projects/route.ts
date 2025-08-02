// app/api/user/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function mapProject(
  project: any,
  role: string,
  permissions: any,
  joined_at: string,
  access_type: string
) {
  return {
    ...project,
    user_role: role,
    user_permissions: permissions,
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

    // Get projects for existing users
    const { data: userProjects, error: userProjectsError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select(`
        id,
        clerk_id,
        project_id,
        role,
        permissions,
        joined_at,
        is_active,
        project:pype_voice_projects!inner (
          id,
          name,
          description,
          environment,
          created_at,
          is_active,
          token_hash,
          owner_clerk_id
        )
      `)
      .eq('clerk_id', userId)
      .eq('is_active', true)
      .eq('project.is_active', true)

    if (userProjectsError) {
      console.error('Error fetching user projects:', userProjectsError)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    // Get projects for pending email mappings
    const { data: emailMappings, error: emailMappingError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select(`
        id,
        email,
        project_id,
        role,
        permissions,
        created_at,
        project:pype_voice_projects!inner (
          id,
          name,
          description,
          environment,
          created_at,
          is_active,
          token_hash,
          owner_clerk_id
        )
      `)
      .eq('email', userEmail)
      .eq('project.is_active', true)

    if (emailMappingError) {
      console.error('Error fetching email mappings:', emailMappingError)
      // Don't fail the request on email mapping errors
    }

    // Combine projects without duplicates
    const allProjects: any[] = []
    const projectIds = new Set<string>()

    if (userProjects) {
      userProjects.forEach(up => {
        // @ts-ignore
        if (!projectIds.has(up.project.id)) {
          allProjects.push(
            mapProject(up.project, up.role, up.permissions, up.joined_at, 'member')
          )
          // @ts-ignore

          projectIds.add(up.project.id)
        }
      })
    }

    if (emailMappings) {
      emailMappings.forEach(em => {
        // @ts-ignore

        if (!projectIds.has(em.project.id)) {
          allProjects.push(
            mapProject(em.project, em.role, em.permissions, em.created_at, 'email_mapped')
          )
          // @ts-ignore
          projectIds.add(em.project.id)
        }
      })
    }

    // Sort by newest project created_at first
    allProjects.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json(allProjects, { status: 200 })
  } catch (error) {
    console.error('Unexpected error fetching user projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
