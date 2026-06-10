import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

/**
 * PATCH /api/phone-numbers/[id]
 * Body: { project_id, acefone_api_key?, assigned_agent_id?, assigned_agent_name?, number_type?, provider?, telephony_type? }
 *
 * DELETE /api/phone-numbers/[id]
 * Body: { project_id }
 */

async function verifyOwnership(id: string, projectId: string) {
  const { data, error } = await supabase
    .from('pype_voice_phone_numbers')
    .select('id, project_id')
    .eq('id', id)
    .single()

  if (error || !data) return { ok: false, status: 404, message: 'Phone number not found' }
  if (String(data.project_id) !== String(projectId))
    return { ok: false, status: 403, message: 'Number does not belong to this project' }
  return { ok: true }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { project_id, acefone_api_key, assigned_agent_id, assigned_agent_name, trunk_direction, provider, telephony_type } = body

    if (!project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

    const ownership = await verifyOwnership(id, project_id)
    if (!ownership.ok) return NextResponse.json({ error: ownership.message }, { status: ownership.status })

    const updates: Record<string, unknown> = {}
    if (acefone_api_key !== undefined) updates.acefone_api_key = acefone_api_key
    if (assigned_agent_id !== undefined) updates.assigned_agent_id = assigned_agent_id
    if (assigned_agent_name !== undefined) updates.assigned_agent_name = assigned_agent_name
    if (trunk_direction !== undefined) updates.trunk_direction = trunk_direction
    if (provider !== undefined) updates.provider = provider
    if (telephony_type !== undefined) updates.telephony_type = telephony_type

    const { data, error } = await supabase
      .from('pype_voice_phone_numbers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating phone number:', error)
      return NextResponse.json({ error: 'Failed to update phone number' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { project_id } = body

    if (!project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

    const ownership = await verifyOwnership(id, project_id)
    if (!ownership.ok) return NextResponse.json({ error: ownership.message }, { status: ownership.status })

    const { error } = await supabase
      .from('pype_voice_phone_numbers')
      .update({ status: 'inactive' })
      .eq('id', id)

    if (error) {
      console.error('Error deleting phone number:', error)
      return NextResponse.json({ error: 'Failed to delete phone number' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
