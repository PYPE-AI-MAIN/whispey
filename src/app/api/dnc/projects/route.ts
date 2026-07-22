import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getSuperAdminEmail } from '@/lib/dnc'

export const runtime = 'nodejs'

/**
 * GET /api/dnc/projects
 * Superadmin only. Returns the projects THIS superadmin is mapped to (same
 * visibility rule as /api/projects) — we don't expose projects they have no
 * access to. Used to populate the searchable project selector for project-scoped
 * DNC entries.
 */
export async function GET() {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await auth()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress
  if (!userId || !email) return NextResponse.json({ projects: [] })

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_email_project_mapping')
    .select('project:pype_voice_projects ( id, name, is_active )')
    .eq('email', email)
    .or('is_active.is.null,is_active.eq.true')

  if (error) {
    console.error('DNC projects error:', error)
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 })
  }

  type ProjRow = { id: string; name: string; is_active?: boolean }
  const projects = (data ?? [])
    // Supabase types a to-one join as an array — normalize to a single row.
    .flatMap((m) => {
      const p = (m as { project: ProjRow | ProjRow[] | null }).project
      return Array.isArray(p) ? p : p ? [p] : []
    })
    .filter((p) => p.is_active !== false)
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ projects })
}
