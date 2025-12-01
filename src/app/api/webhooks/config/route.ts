// src/app/api/webhooks/config/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      project_id,
      agent_id,
      webhook_name,
      webhook_url,
      http_method = 'POST',
      headers = {},
      trigger_events = ['call_log'],
      is_active = true
    } = body

    // Validation
    if (!project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!agent_id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    if (!webhook_url || !webhook_url.trim()) {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(webhook_url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid webhook URL format' },
        { status: 400 }
      )
    }

    // Check if webhook config already exists for this agent
    const { data: existingConfig, error: checkError } = await supabase
      .from('pype_voice_webhook_configs')
      .select('id')
      .eq('agent_id', agent_id)
      .eq('webhook_name', webhook_name || 'Call Log Webhook')
      .maybeSingle()

    let result
    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabase
        .from('pype_voice_webhook_configs')
        .update({
          webhook_url: webhook_url.trim(),
          http_method,
          headers,
          trigger_events,
          is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConfig.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating webhook config:', error)
        return NextResponse.json(
          { error: 'Failed to update webhook configuration' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Create new config
      const { data, error } = await supabase
        .from('pype_voice_webhook_configs')
        .insert({
          project_id,
          agent_id,
          webhook_name: webhook_name || 'Call Log Webhook',
          webhook_url: webhook_url.trim(),
          http_method,
          headers,
          trigger_events,
          is_active
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating webhook config:', error)
        return NextResponse.json(
          { error: 'Failed to create webhook configuration' },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({
      success: true,
      data: result
    }, { status: existingConfig ? 200 : 201 })

  } catch (error) {
    console.error('Unexpected error in webhook config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    const projectId = searchParams.get('project_id')

    if (!agentId && !projectId) {
      return NextResponse.json(
        { error: 'Either agent_id or project_id is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('pype_voice_webhook_configs')
      .select('*')
      .eq('is_active', true)

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching webhook configs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch webhook configurations' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error) {
    console.error('Unexpected error fetching webhook configs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('id')
    const agentId = searchParams.get('agent_id')

    if (!configId && !agentId) {
      return NextResponse.json(
        { error: 'Either id or agent_id is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('pype_voice_webhook_configs')
      .delete()

    if (configId) {
      query = query.eq('id', configId)
    } else if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { error } = await query

    if (error) {
      console.error('Error deleting webhook config:', error)
      return NextResponse.json(
        { error: 'Failed to delete webhook configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook configuration deleted successfully'
    })

  } catch (error) {
    console.error('Unexpected error deleting webhook config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

