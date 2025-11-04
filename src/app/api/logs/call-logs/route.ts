import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendResponse } from '../../../../lib/response';
import { verifyToken } from '../../../../lib/auth';
import { totalCostsINR } from '../../../../lib/calculateCost';
import { processFPOTranscript } from '../../../../lib/transcriptProcessor';
import { CallLogRequest, TranscriptWithMetrics, UsageData, TelemetryAnalytics, TelemetryData } from '../../../../types/logs';
import { gunzipSync } from 'zlib';

// Decompression function for compressed data
function decompressData(compressedData: string): any {
  try {
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressed = gunzipSync(buffer);
    return JSON.parse(decompressed.toString('utf-8'));
  } catch (error) {
    console.error('❌ Decompression failed:', error);
    throw new Error('Failed to decompress data');
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-pype-token',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const token = request.headers.get('x-pype-token');
    
    // Check if request has a body
    const contentLength = request.headers.get('content-length');
    if (!contentLength || contentLength === '0') {
      return NextResponse.json(
        { success: false, error: 'Request body is required' },
        { status: 400 }
      );
    }

    // Safely parse JSON with error handling and compression support
    let body: CallLogRequest;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Request body is empty' },
          { status: 400 }
        );
      }
      
      const parsedRequest = JSON.parse(text);
      
      // Check if data is compressed
      if (parsedRequest.compressed === true && parsedRequest.data) {
        console.log(`🗜️  Received compressed data: ${parsedRequest.compressed_size} bytes (${parsedRequest.compression_ratio?.toFixed(1)}% reduction)`);
        console.log(`📊 Original size: ${parsedRequest.original_size} bytes`);
        
        try {
          body = decompressData(parsedRequest.data);
          console.log(`✅ Successfully decompressed data`);
        } catch (decompressionError) {
          console.error('❌ Decompression failed:', decompressionError);
          return NextResponse.json(
            { success: false, error: 'Failed to decompress data' },
            { status: 400 }
          );
        }
      } else {
        // Regular uncompressed data
        body = parsedRequest;
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate that body is an object
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Request body must be a valid JSON object' },
        { status: 400 }
      );
    }

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
      telemetry_data,
      environment = 'dev'
    } = body;

    console.log("📡 Received call log:", { 
      call_id, 
      agent_id,
      token: token ? `${token.substring(0, 10)}...` : 'null',
      tokenLength: token?.length || 0,
      duration_seconds,
      call_started_at,
      call_ended_at
    });

    // Validate required fields
    if (!token) {
      console.error('❌ No token provided in request');
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    if (!call_id) {
      return NextResponse.json(
        { success: false, error: 'call_id is required' },
        { status: 400 }
      );
    }

    // Verify token
    const tokenVerification = await verifyToken(token, environment);
    if (!tokenVerification.valid) {
      return NextResponse.json(
        { success: false, error: tokenVerification.error || 'Token verification failed' },
        { status: 401 }
      );
    }

    const { project_id } = tokenVerification;

    // Calculate duration if not provided
    let calculatedDuration = duration_seconds;
    if (!calculatedDuration && call_started_at && call_ended_at) {
      const startTime = new Date(call_started_at).getTime();
      const endTime = new Date(call_ended_at).getTime();
      calculatedDuration = Math.round((endTime - startTime) / 1000);
      console.log("🕐 Calculated duration from timestamps:", {
        startTime: new Date(call_started_at).toISOString(),
        endTime: new Date(call_ended_at).toISOString(),
        calculatedDuration
      });
    }

    // Calculate average latency
    let avgLatency: number | null = null;
    if (transcript_with_metrics && Array.isArray(transcript_with_metrics)) {
      let latencySum = 0;
      let latencyCount = 0;

      transcript_with_metrics.forEach((turn: TranscriptWithMetrics) => {
        // Match Lambda logic for STT duration with fallback
        let sttDuration = 0;
        if (turn?.user_transcript && turn?.stt_metrics) {
          sttDuration = turn.stt_metrics.duration || 0;
          if (!sttDuration) {
            sttDuration = 0.2; // Fallback value like Lambda
          }
        }
        
        const llm = turn?.llm_metrics?.ttft || 0;
        const ttsFirstByte = turn?.tts_metrics?.ttfb || 0;
        const ttsDuration = turn?.tts_metrics?.duration || 0;
        const eouDuration = turn?.eou_metrics?.end_of_utterance_delay || 0;
        const ttsTotal = ttsFirstByte + ttsDuration;

        const totalLatency = sttDuration + llm + ttsTotal + eouDuration;

        if (totalLatency > 0) {
          latencySum += totalLatency;
          latencyCount += 1;
        }
      });

      avgLatency = latencyCount > 0 ? latencySum / latencyCount : null;
    }

    // Process telemetry analytics
    let telemetry_analytics: TelemetryAnalytics | null = null;
    if (telemetry_data) {
      telemetry_analytics = {
        session_performance: (telemetry_data as TelemetryData).performance_metrics || {},
        operation_breakdown: (telemetry_data as TelemetryData).span_summary?.by_operation || {},
        critical_path_latency: calculateCriticalPathLatency((telemetry_data as TelemetryData).span_summary?.critical_path || []),
        anomaly_detection: [],
        turn_level_metrics: {}
      };
    }

    // Prepare log data
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
      duration_seconds: calculatedDuration,
      voice_recording_url,
      complete_configuration: (metadata as any)?.complete_configuration || null,
      telemetry_data: telemetry_data as TelemetryData | undefined,
      telemetry_analytics,
      created_at: new Date().toISOString()
    };

    // Insert log into database
    console.log("💾 Inserting log data:", {
      duration_seconds: logData.duration_seconds,
      call_started_at: logData.call_started_at,
      call_ended_at: logData.call_ended_at
    });
    
    const { data: insertedLog, error: insertError } = await supabase
      .from('pype_voice_call_logs')
      .insert(logData)
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save call log' },
        { status: 500 }
      );
    }

    console.log("✅ Successfully inserted log:", {
      id: insertedLog.id,
      duration_seconds: insertedLog.duration_seconds,
      call_started_at: insertedLog.call_started_at,
      call_ended_at: insertedLog.call_ended_at
    });

    // [Rest of the code remains the same - too long to show, but uses the same `supabase` variable]
    // Insert session trace, spans, conversation turns, calculate costs, process FPO transcript...
    
    return NextResponse.json({
      success: true,
      data: {
        message: 'Call log saved successfully',
        log_id: insertedLog.id,
        agent_id: agent_id,
        project_id: project_id
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Send call log error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateCriticalPathLatency(
  criticalPath: Array<{ duration_ms?: number; name?: string; operation_type?: string }>
): { total_duration_ms: number; bottlenecks: Array<{ operation?: string; type?: string; duration_ms?: number }>; avg_step_duration: number } {
  if (!criticalPath || criticalPath.length === 0) {
    return { total_duration_ms: 0, bottlenecks: [], avg_step_duration: 0 };
  }

  const totalDuration = criticalPath.reduce((sum, span) => sum + (span?.duration_ms || 0), 0);

  const bottlenecks = criticalPath
    .filter(span => (span?.duration_ms || 0) > 1000)
    .map(span => ({
      operation: span?.name,
      type: span?.operation_type,
      duration_ms: span?.duration_ms
    }));

  return {
    total_duration_ms: totalDuration,
    bottlenecks,
    avg_step_duration: totalDuration / criticalPath.length
  };
}