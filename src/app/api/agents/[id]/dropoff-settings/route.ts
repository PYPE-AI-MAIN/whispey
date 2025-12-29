// src/app/api/agents/[id]/dropoff-settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// GET: Fetch drop-off settings for an agent
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
      .from('pype_voice_agent_dropoff_settings')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .single()

    if (error) {
      // If no record found, return null (not an error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ data: null })
      }
      console.error('Error fetching drop-off settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch drop-off settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in GET drop-off settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST: Create or update drop-off settings for an agent
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

    const { enabled, dropoff_message, delay_minutes, max_retries, context_dropoff_prompt, call_retry_required_criteria, sip_trunk_id, phone_number_id } = body

    // Validate required fields
    if (delay_minutes === undefined || delay_minutes === null) {
      return NextResponse.json(
        { error: 'delay_minutes is required' },
        { status: 400 }
      )
    }

    if (delay_minutes < 0) {
      return NextResponse.json(
        { error: 'delay_minutes must be non-negative' },
        { status: 400 }
      )
    }

    // Validate max_retries
    if (max_retries !== undefined && max_retries !== null) {
      if (max_retries < 0 || max_retries > 10) {
        return NextResponse.json(
          { error: 'max_retries must be between 0 and 10' },
          { status: 400 }
        )
      }
    }

    // Fetch agent from pype_voice_agents table
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('name, metrics')
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
      .from('pype_voice_agent_dropoff_settings')
      .select('id')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .single()

    const settingsData = {
      agent_id: agentId,
      agent_name: agentNameWithId, // Store agent name with ID (e.g., "MyAgent_abc123_def456")
      enabled: enabled !== undefined ? enabled : false,
      dropoff_message: dropoff_message || null,
      delay_minutes,
      max_retries: max_retries !== undefined && max_retries !== null ? max_retries : 2,
      context_dropoff_prompt: context_dropoff_prompt || null,
      sip_trunk_id: sip_trunk_id || null,
      phone_number_id: phone_number_id || null,
      updated_at: new Date().toISOString(),
    }

    let result
    if (existing) {
      // Update existing settings
      const { data, error } = await supabase
        .from('pype_voice_agent_dropoff_settings')
        .update(settingsData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating drop-off settings:', error)
        return NextResponse.json(
          { error: 'Failed to update drop-off settings' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Create new settings
      const { data, error } = await supabase
        .from('pype_voice_agent_dropoff_settings')
        .insert({
          ...settingsData,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating drop-off settings:', error)
        return NextResponse.json(
          { error: 'Failed to create drop-off settings' },
          { status: 500 }
        )
      }

      result = data
    }

    // Always update agent metrics to ensure call_retry_required is enabled
    try {
      // Parse existing metrics or initialize empty object
      let currentMetrics: Record<string, any> = {}
      if (agent.metrics) {
        try {
          currentMetrics = typeof agent.metrics === 'string' 
            ? JSON.parse(agent.metrics) 
            : agent.metrics
        } catch (parseError) {
          console.warn('Error parsing existing metrics, starting fresh:', parseError)
          currentMetrics = {}
        }
      }

      // Store criteria as a string (not parsed as object)
      // Criteria should be a JSON string, not a parsed object
      let criteriaString: string | null = null
      
      // Check if new criteria was provided in the request
      if (call_retry_required_criteria !== undefined && call_retry_required_criteria !== null) {
        // If it's already a string (including empty string), use it directly
        if (typeof call_retry_required_criteria === 'string') {
          criteriaString = call_retry_required_criteria
        } else {
          // If it's an object, stringify it
          try {
            criteriaString = JSON.stringify(call_retry_required_criteria, null, 2)
          } catch (stringifyError) {
            // If stringify fails, convert to string
            criteriaString = String(call_retry_required_criteria)
          }
        }
      } else if (currentMetrics?.call_retry_required?.criteria !== undefined && currentMetrics?.call_retry_required?.criteria !== null) {
        // If no new criteria provided, preserve existing criteria if it exists
        const existingCriteria = currentMetrics.call_retry_required.criteria
        // Ensure existing criteria is stored as string
        if (typeof existingCriteria === 'string') {
          criteriaString = existingCriteria
        } else {
          // If existing is an object, stringify it
          try {
            criteriaString = JSON.stringify(existingCriteria, null, 2)
          } catch (stringifyError) {
            criteriaString = String(existingCriteria)
          }
        }
      }
      
      // If still null (no criteria provided and no existing), use null (don't set default here)
      // The component will handle defaults on the frontend

      // Update or add call_retry_required metric (always enable it)
      // Store criteria as a string, not as a parsed object
      currentMetrics.call_retry_required = {
        metric_id: 'call_retry_required',
        enabled: true,
        criteria: criteriaString,
        scoring_mode: 'binary',
        threshold: 1,
      }

      // Update agent metrics in database
      const { error: metricsUpdateError } = await supabase
        .from('pype_voice_agents')
        .update({ metrics: currentMetrics })
        .eq('id', agentId)

      if (metricsUpdateError) {
        console.error('Error updating agent metrics:', metricsUpdateError)
        // Don't fail the entire request, just log the error
        // The drop-off settings are saved, metrics update is a bonus
      } else {
        console.log('Successfully updated call_retry_required metric')
      }
    } catch (metricsError) {
      console.error('Error processing metrics update:', metricsError)
      // Don't fail the entire request
    }

    return NextResponse.json({ 
      success: true, 
      data: result 
    })
  } catch (error: any) {
    console.error('Error in POST drop-off settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE: Deactivate drop-off settings for an agent
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
      .from('pype_voice_agent_dropoff_settings')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('agent_id', agentId)
      .eq('is_active', true)

    if (error) {
      console.error('Error deactivating drop-off settings:', error)
      return NextResponse.json(
        { error: 'Failed to deactivate drop-off settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE drop-off settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

