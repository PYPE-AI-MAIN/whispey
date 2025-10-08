import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the user's data from pype_voice_users table
    const { data: userData, error: userError } = await supabase
      .from('pype_voice_users')
      .select('agent, email')
      .eq('clerk_id', userId)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    if (!userData || !userData.agent) {
      // Return empty structure if no agent data exists
      return NextResponse.json({
        usage: { active_count: 0 },
        agents: [],
        limits: { max_agents: 0 },
        last_updated: new Date().toISOString()
      })
    }

    // Return the agent data directly as it's already in the correct format
    return NextResponse.json(userData.agent)

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Optional: Add POST endpoint to update phone numbers
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate the request body
    if (!body.agents || !Array.isArray(body.agents)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Update the agent field in the database
    const { error: updateError } = await supabase
      .from('pype_voice_users')
      .update({
        agent: {
          usage: body.usage || { active_count: body.agents.length },
          agents: body.agents,
          limits: body.limits || { max_agents: 10 },
          last_updated: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('clerk_id', userId)

    if (updateError) {
      console.error('Error updating user data:', updateError)
      return NextResponse.json(
        { error: 'Failed to update phone numbers' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Phone numbers updated successfully'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Optional: Add PUT endpoint to update a specific agent
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { agentId, updates } = body

    if (!agentId || !updates) {
      return NextResponse.json(
        { error: 'Missing agentId or updates' },
        { status: 400 }
      )
    }

    // First, get the current agent data
    const { data: userData, error: fetchError } = await supabase
      .from('pype_voice_users')
      .select('agent')
      .eq('clerk_id', userId)
      .single()

    if (fetchError || !userData?.agent) {
      return NextResponse.json(
        { error: 'Failed to fetch current data' },
        { status: 500 }
      )
    }

    // Update the specific agent
    const updatedAgents = userData.agent.agents.map((agent: any) => 
      agent.id === agentId ? { ...agent, ...updates } : agent
    )

    // Update the database
    const { error: updateError } = await supabase
      .from('pype_voice_users')
      .update({
        agent: {
          ...userData.agent,
          agents: updatedAgents,
          last_updated: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('clerk_id', userId)

    if (updateError) {
      console.error('Error updating agent:', updateError)
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Agent updated successfully'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}