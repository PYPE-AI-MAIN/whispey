import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

/**
 * GET /api/phone-numbers/available?project_id=...
 *
 * Returns all active phone numbers for a project.
 * Used by:
 * - AgentList cards: filter by assigned_agent_id to show inbound number per agent
 * - phone-call-config: show all numbers with type labels
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const { data: numbers, error } = await supabase
      .from('pype_voice_phone_numbers')
      .select(
        'id, phone_number, number_type, provider, trunk_direction, trunk_id, assigned_agent_id, assigned_agent_name, status'
      )
      .eq('project_id', projectId)
      .eq('status', 'active')
      .order('phone_number')

    if (error) {
      console.error('Error fetching phone numbers:', error)
      return NextResponse.json({ error: 'Failed to fetch phone numbers' }, { status: 500 })
    }

    return NextResponse.json(numbers ?? [])
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
