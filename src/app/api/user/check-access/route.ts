// src/app/api/user/check-access/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    // Check if user is SUPERADMIN
    const { data: userData } = await supabase
      .from('pype_voice_users')
      .select('roles')
      .eq('clerk_id', userId)
      .maybeSingle()

    const isSuperAdmin = userData?.roles?.type === 'SUPERADMIN'

    // If no project_id, just return superadmin status
    if (!projectId) {
      return NextResponse.json({ 
        isSuperAdmin,
        hasProjectAccess: false 
      })
    }

    // Get project-level access
    const { data: projectMapping, error } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('role, permissions')
      .eq('clerk_id', userId)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !projectMapping) {
      return NextResponse.json({
        isSuperAdmin,
        hasProjectAccess: false
      })
    }

    // Get project details
    const { data: project } = await supabase
      .from('pype_voice_projects')
      .select('agent, plans')
      .eq('id', projectId)
      .single()

    return NextResponse.json({
      isSuperAdmin,
      hasProjectAccess: true,
      role: projectMapping.role,
      permissions: projectMapping.permissions,
      projectPlan: project?.plans,
      agentData: project?.agent
    })

  } catch (error) {
    console.error('Error checking access:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}