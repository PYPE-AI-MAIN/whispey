import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

/**
 * PATCH /api/phone-numbers/assign-agent
 * Body: { number_id, agent_id, agent_name }
 * Pass agent_id: null to unassign.
 *
 * Rules:
 * - Number must belong to the given project_id
 * - If another agent in the same project already holds this number, return 409
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { number_id, agent_id, agent_name, project_id } = body

    if (!number_id || !project_id) {
      return NextResponse.json(
        { error: 'number_id and project_id are required' },
        { status: 400 }
      )
    }

    // Fetch the number and verify it belongs to this project
    const { data: number, error: fetchError } = await supabase
      .from('pype_voice_phone_numbers')
      .select('id, assigned_agent_id, project_id')
      .eq('id', number_id)
      .single()

    if (fetchError || !number) {
      return NextResponse.json({ error: 'Phone number not found' }, { status: 404 })
    }

    if (String(number.project_id) !== String(project_id)) {
      return NextResponse.json({ error: 'Number does not belong to this project' }, { status: 403 })
    }

    // If assigning (not unassigning), check no other number in this project is already
    // assigned to this agent (1 agent → 1 inbound number)
    if (agent_id) {
      const { data: conflict } = await supabase
        .from('pype_voice_phone_numbers')
        .select('id, phone_number')
        .eq('project_id', project_id)
        .eq('assigned_agent_id', agent_id)
        .neq('id', number_id)
        .maybeSingle()

      if (conflict) {
        return NextResponse.json(
          {
            error: `Agent already has an inbound number assigned: ${conflict.phone_number}`,
            conflict_number_id: conflict.id,
          },
          { status: 409 }
        )
      }
    }

    // Do the update
    const { error: updateError } = await supabase
      .from('pype_voice_phone_numbers')
      .update({
        assigned_agent_id: agent_id ?? null,
        assigned_agent_name: agent_name ?? null,
      })
      .eq('id', number_id)

    if (updateError) {
      console.error('Error assigning agent to number:', updateError)
      return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
