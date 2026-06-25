import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getCallerGlobalRole } from '@/lib/prod-auth'

export const runtime = 'nodejs'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRole = await getCallerGlobalRole(userId)
  if (callerRole !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const supabase = createServiceRoleClient()
  const { error, count } = await supabase
    .from('pype_voice_metrics_templates')
    .delete({ count: 'exact' })
    .eq('metric_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (count === 0) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
