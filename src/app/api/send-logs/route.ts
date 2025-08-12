// app/api/send-logs/route.ts - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'
import crypto from 'crypto'

// Helper function to verify token (mock version)
const verifyToken = async (token: string, environment = 'dev') => {
  try {
    // In mock mode, we'll accept any token that starts with 'pype_'
    if (!token || !token.startsWith('pype_')) {
      return { valid: false, error: 'Invalid token format' }
    }

    // Get a demo project for the token
    const projects = jsonFileService.getProjects()
    const project = projects[0] // Use first project for demo

    if (!project) {
      return { valid: false, error: 'No demo project found' }
    }

    return { 
      valid: true, 
      token: { ...project, token_hash: token },
      project_id: project.id
    }
  } catch (error) {
    console.error('Token verification error:', error)
    return { valid: false, error: 'Token verification failed' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Extract authentication token from headers
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || body.token

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      )
    }

    // Verify the token
    const tokenVerification = await verifyToken(token, body.environment)
    if (!tokenVerification.valid) {
      return NextResponse.json(
        { error: tokenVerification.error },
        { status: 401 }
      )
    }

    const projectId = tokenVerification.project_id

    // Validate required fields
    const requiredFields = ['call_id', 'agent_id', 'customer_number']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate agent exists and belongs to the project
    const agent = jsonFileService.getAgentById(body.agent_id)
    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid agent_id' },
        { status: 400 }
      )
    }

    if (agent.project_id !== projectId) {
      return NextResponse.json(
        { error: 'Agent does not belong to the authenticated project' },
        { status: 403 }
      )
    }

    // Create call log entry using mock data service
    const callLogData = {
      call_id: body.call_id,
      agent_id: body.agent_id,
      customer_number: body.customer_number,
      call_ended_reason: body.call_ended_reason || 'completed',
      transcript_type: body.transcript_type || 'final',
      transcript_json: body.transcript_json || {},
      metadata: body.metadata || {},
      dynamic_variables: body.dynamic_variables || {},
      environment: body.environment || 'dev',
      call_started_at: body.call_started_at || new Date().toISOString(),
      call_ended_at: body.call_ended_at || new Date().toISOString(),
      duration_seconds: body.duration_seconds || 0,
      recording_url: body.recording_url || '',
      avg_latency: body.avg_latency || 0,
      transcription_metrics: body.transcription_metrics || {},
      total_stt_cost: body.total_stt_cost || 0,
      total_tts_cost: body.total_tts_cost || 0,
      total_llm_cost: body.total_llm_cost || 0
    }

    const ok = jsonFileService.addCallLog(callLogData)

    console.log(`Successfully stored call log for call_id: ${body.call_id}`)

    return NextResponse.json({
      success: true,
      message: 'Call log stored successfully',
      call_log_id: callLogData.call_id,
      timestamp: new Date().toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('Error storing call log:', error)
    return NextResponse.json(
      { 
        error: 'Failed to store call log',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}