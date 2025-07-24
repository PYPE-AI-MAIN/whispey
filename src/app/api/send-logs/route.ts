// app/api/call-logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Create Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to verify token
const verifyToken = async (token: string, environment = 'dev') => {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { data: authToken, error } = await supabase
      .from('pype_voice_projects')
      .select('*')
      .eq('token_hash', tokenHash)
      .single()

    if (error || !authToken) {
      return { valid: false, error: 'Invalid or expired token' }
    }

    return { 
      valid: true, 
      token: authToken,
      project_id: authToken.id
    }
  } catch (error) {
    console.error('Token verification error:', error)
    return { valid: false, error: 'Token verification failed' }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const token = request.headers.get('x-pype-token')

    const { 
      call_id, 
      customer_number, 
      agent_id,
      call_ended_reason, 
      transcript_type, 
      transcript_json, 
      metadata, 
      dynamic_variables, 
      call_started_at, 
      call_ended_at, 
      duration_seconds, 
      transcript_with_metrics,
      recording_url,
      voice_recording_url,
      environment = 'dev'
    } = body

    console.log("body", body)

    // Validate required fields
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    if (!call_id) {
      return NextResponse.json(
        { error: 'call_id is required' },
        { status: 400 }
      )
    }

    // Verify token
    const tokenVerification = await verifyToken(token, environment)
    console.log("tokenVerification", tokenVerification)

    if (!tokenVerification.valid) {
      return NextResponse.json(
        { error: tokenVerification.error },
        { status: 401 }
      )
    }

    const { project_id } = tokenVerification

    // Calculate average latency
    let avgLatency = null

    if (transcript_with_metrics && Array.isArray(transcript_with_metrics)) {
      let latencySum = 0
      let latencyCount = 0
    
      transcript_with_metrics.forEach(turn => {
        const stt = turn?.stt_metrics?.duration || 0
        const llm = turn?.llm_metrics?.ttft || 0
        
        // CORRECTED: Include full TTS duration, not just TTFB
        const ttsFirstByte = turn?.tts_metrics?.ttfb || 0
        const ttsDuration = turn?.tts_metrics?.duration || 0
        const eouDuration = turn?.eou_metrics?.end_of_utterance_delay || 0
        const ttsTotal = ttsFirstByte + ttsDuration
    
        const totalLatency = stt + llm + ttsTotal + eouDuration
    
        // Only include turns with valid metrics
        if (totalLatency > 0) {
          latencySum += totalLatency
          latencyCount += 1
        }
      })
    
      avgLatency = latencyCount > 0 ? latencySum / latencyCount : null
    }

    console.log("calculated avgLatency", avgLatency)

    // Prepare log data for Supabase
    const logData = {
      call_id,
      agent_id,
      customer_number,
      call_ended_reason,
      transcript_type,
      transcript_json,
      avg_latency: avgLatency,
      metadata,
      dynamic_variables,
      environment,
      call_started_at,
      call_ended_at,
      recording_url,
      duration_seconds,
      voice_recording_url,
      created_at: new Date().toISOString()
    }

    // Insert log into Supabase
    const { data: insertedLog, error: insertError } = await supabase
      .from('pype_voice_call_logs')
      .insert(logData)
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save call log' },
        { status: 500 }
      )
    }

    // Process metrics and insert into ClickHouse
    if (transcript_with_metrics && Array.isArray(transcript_with_metrics)) {

      // Also insert into Supabase for backup/compatibility
      const conversationTurns = transcript_with_metrics.map(turn => ({
        session_id: insertedLog.id,  
        turn_id: turn.turn_id,
        user_transcript: turn.user_transcript || '',
        agent_response: turn.agent_response || '',
        stt_metrics: turn.stt_metrics || {},
        llm_metrics: turn.llm_metrics || {},
        tts_metrics: turn.tts_metrics || {},
        eou_metrics: turn.eou_metrics || {},
        lesson_day: metadata?.lesson_day || 1,
        phone_number: customer_number,
        call_duration: duration_seconds,
        call_success: call_ended_reason !== 'error',
        lesson_completed: metadata?.lesson_completed || false,
        created_at: new Date().toISOString(),
        unix_timestamp: turn.timestamp
      }))
 
      // Insert all conversation turns to Supabase
      const { error: turnsError } = await supabase
        .from('pype_voice_metrics_logs')
        .insert(conversationTurns)
 
      if (turnsError) {
        console.error('Error inserting conversation turns to Supabase:', turnsError)
      } else {
        console.log(`Inserted ${conversationTurns.length} conversation turns to Supabase`)
      }
    }



    return NextResponse.json({
      message: 'Call log saved successfully',
      log_id: insertedLog.id,
      agent_id: agent_id,
      project_id: project_id
    }, { status: 200 })

  } catch (error) {
    console.error('Send call log error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}