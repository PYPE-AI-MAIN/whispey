import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendResponse } from '../../../../lib/response';
import { verifyToken } from '../../../../lib/auth';
import { totalCostsINR } from '../../../../lib/calculateCost';
import { processFPOTranscript } from '../../../../lib/transcriptProcessor';
import { CallLogRequest, TranscriptWithMetrics, UsageData, TelemetryAnalytics, TelemetryData } from '../../../../types/logs';
import { gunzipSync } from 'zlib';

// Create server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      duration_seconds: calculatedDuration, // Use calculated duration
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

    // Insert session trace and spans if telemetry present
    if (telemetry_data && (telemetry_data as any).session_traces && (telemetry_data as any).session_traces.length > 0) {
      const traceKey = `session_${insertedLog.id}`;

      const { data: insertedTrace, error: traceError } = await supabase
        .from('pype_voice_session_traces')
        .insert({
          session_id: insertedLog.id,
          trace_key: traceKey,
          total_spans: (telemetry_data as any).session_traces.length,
          performance_summary: (telemetry_data as any).performance_metrics || {},
          span_summary: (telemetry_data as any).span_summary || {},
          session_start_time: call_started_at,
          session_end_time: call_ended_at,
          total_duration_ms: duration_seconds ? duration_seconds * 1000 : null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!traceError && insertedTrace) {
        const spanInserts = (telemetry_data as any).session_traces.map((span: any) => ({
          trace_key: traceKey,
          span_id: span.span_id || span.context?.span_id,
          trace_id: span.trace_id || span.context?.trace_id,
          name: span.name,
          operation_type: span.operation_type,
          start_time_ns: span.start_time_ns,
          end_time_ns: span.end_time_ns,
          duration_ms: span.duration_ms ? Math.round(span.duration_ms) : null,
          duration_ns: span.duration_ns,
          status: span.status,
          attributes: span.attributes,
          events: span.events,
          metadata: span.metadata,
          request_id: span.request_id,
          parent_span_id: span.parent_span_id,
          captured_at: span.captured_at ? new Date(span.captured_at * 1000).toISOString() : null,
          context: span.context,
          request_id_source: span.request_id_source
        }));

        const { error: spansError } = await supabase
          .from('pype_voice_spans')
          .insert(spanInserts)
          .select('id');

        if (spansError) {
          console.error('SPANS INSERT ERROR:', spansError);
        }
      } else if (traceError) {
        console.error('SESSION TRACE INSERT ERROR:', traceError);
      }
    }

    // Insert conversation turns if metrics exist
    if (transcript_with_metrics && Array.isArray(transcript_with_metrics)) {
      const conversationTurns = transcript_with_metrics.map((turn: TranscriptWithMetrics) => {
        const basicFields = new Set([
          'turn_id', 'user_transcript', 'agent_response',
          'stt_metrics', 'llm_metrics', 'tts_metrics', 'eou_metrics',
          'trace_id', 'otel_spans', 'tool_calls', 'trace_duration_ms',
          'trace_cost_usd', 'timestamp', 'turn_configuration', 'bug_report'
        ]);

        const enhancedData: Record<string, unknown> = {};
        Object.keys(turn as any).forEach((key) => {
          const value = (turn as any)[key];
          if (!basicFields.has(key) && value !== undefined && value !== null) {
            (enhancedData as any)[key] = value;
          }
        });

        const hasEnhancedData = Object.keys(enhancedData).length > 0;

        return {
          session_id: insertedLog.id,
          turn_id: turn.turn_id,
          user_transcript: turn.user_transcript || '',
          agent_response: turn.agent_response || '',
          stt_metrics: turn.stt_metrics || {},
          llm_metrics: turn.llm_metrics || {},
          tts_metrics: turn.tts_metrics || {},
          eou_metrics: turn.eou_metrics || {},
          trace_id: (turn as any).trace_id || null,
          trace_duration_ms: (turn as any).trace_duration_ms || null,
          trace_cost_usd: (turn as any).trace_cost_usd || null,
          lesson_day: (metadata as any)?.lesson_day || 1,
          phone_number: customer_number,
          call_duration: duration_seconds,
          call_success: call_ended_reason !== 'error',
          lesson_completed: (metadata as any)?.lesson_completed || false,
          created_at: new Date().toISOString(),
          unix_timestamp: (turn as any).timestamp as any,
          turn_configuration: (turn as any).turn_configuration || null,
          bug_report: (turn as any).bug_report || false,
          bug_details: (turn as any).bug_details || null,
          enhanced_data: hasEnhancedData ? enhancedData : null,
          tool_calls: (turn as any).tool_calls || []
        };
      });

      const { error: turnsError } = await supabase
        .from('pype_voice_metrics_logs')
        .insert(conversationTurns);

      if (turnsError) {
        console.error('Error inserting conversation turns:', turnsError);
      } else {
        console.log(`Inserted ${conversationTurns.length} conversation turns`);
      }
    }

    // Calculate and update costs
    if (metadata?.usage) {
      const rawUsage = metadata.usage;
      const usageArr: UsageData[] = Array.isArray(rawUsage)
        ? rawUsage
        : rawUsage && typeof rawUsage === 'object'
          ? [rawUsage]
          : [];

      const { total_llm_cost_inr, total_tts_cost_inr, total_stt_cost_inr } =
        await totalCostsINR({
          usageArr: usageArr,
          modelName: 'gpt-4.1-mini',
          callStartedAt: call_started_at
        });

      const { error: costError } = await supabase
        .from('pype_voice_call_logs')
        .update({
          total_llm_cost: total_llm_cost_inr,
          total_tts_cost: total_tts_cost_inr,
          total_stt_cost: total_stt_cost_inr
        })
        .eq('id', insertedLog.id);

      if (costError) {
        console.log("Total cost insertion error:", costError);
      } else {
        console.log("✅ Costs updated:", {
          total_llm_cost_inr,
          total_tts_cost_inr,
          total_stt_cost_inr
        });
      }
    }

    // Process transcript with field extraction
    const { data: agentConfig, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('field_extractor, field_extractor_prompt')
      .eq('id', agent_id)
      .single();

    if (agentError) {
      console.error('Failed to fetch agent config:', agentError);
    } else if (agentConfig?.field_extractor && agentConfig?.field_extractor_prompt) {
      try {
        const transcriptToSend = (Array.isArray(transcript_json) && transcript_json.length > 0)
          ? transcript_json
          : (Array.isArray(transcript_with_metrics) && transcript_with_metrics.length > 0)
            ? transcript_with_metrics
            : null;

        if (transcriptToSend) {
          const fpoResult = await processFPOTranscript({
            log_id: insertedLog.id,
            transcript_json: transcriptToSend as any,
            agent_id: agent_id || '',
            field_extractor_prompt: agentConfig.field_extractor_prompt,
          });

          const { error: insertFpoError } = await supabase
            .from('pype_voice_call_logs')
            .update({
              transcription_metrics: fpoResult?.logData
            })
            .eq('id', insertedLog.id);

          if (insertFpoError) {
            console.error('Error updating FPO transcript log:', insertFpoError);
          }

          console.log("✅ FPO transcript processed:", fpoResult);
        } else {
          console.log('No valid transcript data to process');
        }
      } catch (fpoError) {
        console.error("❌ FPO processing failed:", fpoError);
      }
    }

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