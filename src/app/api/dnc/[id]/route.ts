import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { DNC_TABLE, getSuperAdminEmail } from '@/lib/dnc'

export const runtime = 'nodejs'

/**
 * DELETE /api/dnc/:id
 * Superadmin only. Soft-delete (is_active=false) to preserve the audit trail;
 * the row can be re-added later without losing history.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from(DNC_TABLE)
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_active', true)

  if (error) {
    console.error('DNC delete error:', error)
    return NextResponse.json({ error: 'Failed to remove number' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
