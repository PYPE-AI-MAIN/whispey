import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getCallerGlobalRole } from '@/lib/prod-auth'

export const runtime = 'nodejs'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRole = await getCallerGlobalRole(userId)
  if (callerRole !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_metrics_templates')
    .select('*')
    .order('priority', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRole = await getCallerGlobalRole(userId)
  if (callerRole !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { metric_id, name, description, default_criteria, default_scoring_mode, default_threshold, category, priority } = body

  if (!metric_id || !name || !default_criteria || !default_scoring_mode) {
    return NextResponse.json({ error: 'Missing required fields: metric_id, name, default_criteria, default_scoring_mode' }, { status: 400 })
  }

  if (!['continuous', 'binary'].includes(default_scoring_mode)) {
    return NextResponse.json({ error: 'default_scoring_mode must be continuous or binary' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_metrics_templates')
    .insert({
      metric_id,
      name,
      description: description ?? '',
      default_criteria,
      default_scoring_mode,
      default_threshold: default_threshold ?? 0.7,
      category: category ?? 'general',
      priority: priority ?? 'medium',
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A template with this metric_id already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
