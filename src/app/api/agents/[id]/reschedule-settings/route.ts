// src/app/api/agents/[id]/reschedule-settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// GET: Fetch reschedule settings for an agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('pype_voice_agent_reschedule_settings')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .single()

    if (error) {
      // If no record found, return null (not an error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ data: null })
      }
      console.error('Error fetching reschedule settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reschedule settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in GET reschedule settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST: Create or update reschedule settings for an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json()

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    const { enabled, reschedule_message, reschedule_criteria, sip_trunk_id, phone_number_id } = body

    // Fetch agent name from pype_voice_agents table
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('name')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      console.error('Error fetching agent:', agentError)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Construct agent name with ID (sanitized ID format: replace hyphens with underscores)
    const sanitizedAgentId = agentId.replace(/-/g, '_')
    const agentNameWithId = `${agent.name}_${sanitizedAgentId}`

    // Check if settings already exist for this agent
    const { data: existing } = await supabase
      .from('pype_voice_agent_reschedule_settings')
      .select('id')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .single()

    const settingsData = {
      agent_id: agentId,
      agent_name: agentNameWithId, // Store agent name with ID (e.g., "MyAgent_abc123_def456")
      enabled: enabled !== undefined ? enabled : false,
      reschedule_message: reschedule_message || null,
      reschedule_criteria: reschedule_criteria || null,
      sip_trunk_id: sip_trunk_id || null,
      phone_number_id: phone_number_id || null,
      updated_at: new Date().toISOString(),
    }

    let result
    if (existing) {
      // Update existing settings
      const { data, error } = await supabase
        .from('pype_voice_agent_reschedule_settings')
        .update(settingsData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating reschedule settings:', error)
        return NextResponse.json(
          { error: 'Failed to update reschedule settings' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Create new settings
      const { data, error } = await supabase
        .from('pype_voice_agent_reschedule_settings')
        .insert({
          ...settingsData,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating reschedule settings:', error)
        return NextResponse.json(
          { error: 'Failed to create reschedule settings' },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({ 
      success: true, 
      data: result 
    })
  } catch (error: any) {
    console.error('Error in POST reschedule settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE: Deactivate reschedule settings for an agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('pype_voice_agent_reschedule_settings')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('agent_id', agentId)
      .eq('is_active', true)

    if (error) {
      console.error('Error deactivating reschedule settings:', error)
      return NextResponse.json(
        { error: 'Failed to deactivate reschedule settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE reschedule settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

