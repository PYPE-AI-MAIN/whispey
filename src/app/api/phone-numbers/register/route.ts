import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

/**
 * POST /api/phone-numbers/register
 * Body: { phone_number, number_type, provider, telephony_type, acefone_api_key, project_id }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { phone_number, trunk_direction, provider, telephony_type, acefone_api_key, project_id, custom_headers } = body

    if (!phone_number || !project_id) {
      return NextResponse.json({ error: 'phone_number and project_id are required' }, { status: 400 })
    }

    const resolvedTelephonyType =
      telephony_type ?? (provider?.toLowerCase() === 'acefone' ? 'acefone_bridge' : 'sip')

    const record = {
      phone_number,
      number_type: resolvedTelephonyType,
      provider: provider ?? 'other',
      telephony_type: resolvedTelephonyType,
      acefone_api_key: acefone_api_key ?? null,
      project_id,
      status: 'active',
      trunk_direction: trunk_direction ?? 'bidirectional',
      custom_headers: custom_headers ?? null,
    }

    // Check if this number already exists (avoids needing a unique constraint on prod)
    const { data: existing } = await supabase
      .from('pype_voice_phone_numbers')
      .select('id')
      .eq('phone_number', phone_number)
      .maybeSingle()

    let data, error
    if (existing?.id) {
      // Update existing row
      ;({ data, error } = await supabase
        .from('pype_voice_phone_numbers')
        .update(record)
        .eq('id', existing.id)
        .select()
        .single())
    } else {
      // Insert new row
      ;({ data, error } = await supabase
        .from('pype_voice_phone_numbers')
        .insert(record)
        .select()
        .single())
    }

    if (error) {
      console.error('Error registering phone number:', error)
      return NextResponse.json({ error: 'Failed to register phone number' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
