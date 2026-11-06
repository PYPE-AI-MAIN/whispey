import { NextRequest, NextResponse } from 'next/server';
import { sendResponse } from '../../../../lib/response';
import { verifyToken } from '../../../../lib/auth';
import { totalCostsINR } from '../../../../lib/calculateCost';
import { processFPOTranscript } from '../../../../lib/transcriptProcessor';
import { CallLogRequest, TranscriptWithMetrics, UsageData, TelemetryAnalytics, TelemetryData } from '../../../../types/logs';
import { gunzipSync } from 'zlib'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { withDataPlane, rethrowDataPlane, projectIdForAgent } from '@/server/data-plane'

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

export const POST = withDataPlane(async (dp, request: NextRequest) => {
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
      environment = 'dev',
      wcall_event: bodyWcallEvent
    } = body;

    const wcall_event = (bodyWcallEvent === 'call_started' || bodyWcallEvent === 'call_ended')
      ? bodyWcallEvent
      : 'call_ended';

    console.log("📡 Received call log:", { 
      call_id, 
      agent_id,
      wcall_event: bodyWcallEvent ?? '(not set → defaults to call_ended)',
      resolved_wcall_event: wcall_event,
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

    if (!agent_id) {
      return NextResponse.json(
        { success: false, error: 'agent_id is required' },
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

    // The token names the project and the project's route names where the call is written.
    // A project that cannot be resolved is an error, never Pype's database.
    if (!project_id) {
      return NextResponse.json(
        { success: false, error: 'Project could not be resolved', retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } }
      );
    }
    const plane = await dp.forProject(project_id);
    if (await dp.isCustomerHeld(project_id)) {
      const agentProject = await projectIdForAgent(agent_id);
      if (!agentProject) {
        return NextResponse.json(
          { success: false, error: 'Agent could not be resolved', retryable: true },
          { status: 503, headers: { 'Retry-After': '5' } }
        );
      }
      if (agentProject !== project_id) {
        return NextResponse.json({ success: false, error: 'Agent does not belong to this project' }, { status: 403 });
      }
    }

    if (wcall_event === 'call_started') {
      console.log('🟢 call_started branch hit:', { call_id, agent_id, call_started_at, environment });
      const minimalData = {
        project_id,
        call_id,
        agent_id,
        customer_number: customer_number ?? null,
        call_started_at: call_started_at ?? new Date().toISOString(),
        duration_seconds: 0,
        environment,
        wcall_event: 'call_started' as const,
        created_at: new Date().toISOString()
      };
      const existing = await plane.callLogs.findStartedLog(agent_id, call_id);
      console.log('🔍 call_started existing row check:', existing ? `found id=${existing.id}` : 'not found → will insert');
      if (existing) {
        try {
          await plane.callLogs.updateCallLog(existing.id, {
            call_started_at: minimalData.call_started_at,
            customer_number: minimalData.customer_number,
            duration_seconds: 0
          });
        } catch (updErr) {
          rethrowDataPlane(updErr);
          console.error('❌ call_started update error:', updErr);
          return NextResponse.json(
            { success: false, error: 'Failed to update call_started log' },
            { status: 500 }
          );
        }
        console.log('✅ call_started updated existing row:', existing.id);
        return NextResponse.json({
          success: true,
          data: { message: 'Call started log updated', log_id: existing.id, agent_id, project_id }
        }, { status: 200 });
      }
      let inserted: { id: string };
      try {
        inserted = (await plane.callLogs.insertCallLog(minimalData)) as { id: string };
      } catch (insErr) {
        rethrowDataPlane(insErr);
        console.error('❌ call_started insert error:', insErr);
        return NextResponse.json(
          { success: false, error: 'Failed to save call_started log' },
          { status: 500 }
        );
      }
      console.log('✅ call_started inserted new row:', inserted.id);
      return NextResponse.json({
          success: true,
          data: { message: 'Call started log saved', log_id: inserted.id, agent_id, project_id }
        }, { status: 200 });
    }

    // Calculate duration with fallback priority:
    // 1. Use provided duration_seconds if valid
    // 2. Calculate from timestamps if available
    // 3. Parse from duration_formatted in metadata if present
    let calculatedDuration = typeof duration_seconds === 'string' 
      ? parseFloat(duration_seconds) || 0 
      : (duration_seconds ?? 0);
    
    // If duration_seconds is missing or 0, try to calculate from timestamps
    if ((!calculatedDuration || calculatedDuration === 0) && call_started_at && call_ended_at) {
      const startTime = new Date(call_started_at).getTime();
      const endTime = new Date(call_ended_at).getTime();
      
      if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
        calculatedDuration = Math.round((endTime - startTime) / 1000);
      }
    }
    
    // If still no duration, try to parse from duration_formatted in metadata
    if ((!calculatedDuration || calculatedDuration === 0) && metadata?.duration_formatted) {
      const formatted = metadata.duration_formatted;
      // Parse format like "5m 30s" or "1h 5m 30s"
      const match = formatted.match(/(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/);
      if (match) {
        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);
        const seconds = parseInt(match[3] || '0', 10);
        calculatedDuration = hours * 3600 + minutes * 60 + seconds;
      }
    }
    
    // Ensure valid number
    if (isNaN(calculatedDuration) || calculatedDuration < 0) {
      calculatedDuration = 0;
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

    const logData = {
      project_id,
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
      created_at: new Date().toISOString(),
      wcall_event: 'call_ended' as const
    };

    const existingStarted = await plane.callLogs.findStartedLog(agent_id, call_id);

    let insertedLog: { id: string; [k: string]: any };
    if (existingStarted) {
      try {
        insertedLog = await plane.callLogs.updateCallLog(existingStarted.id, logData) as { id: string; [k: string]: any };
      } catch (updateError) {
        rethrowDataPlane(updateError);
        console.error('Database update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update call log' },
          { status: 500 }
        );
      }
    } else {
      try {
        insertedLog = await plane.callLogs.insertCallLog(logData) as { id: string; [k: string]: any };
      } catch (insertError) {
        rethrowDataPlane(insertError);
        console.error('Database insert error:', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to save call log' },
          { status: 500 }
        );
      }
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

      let insertedTrace: Record<string, any> | null = null;
      let traceError: unknown = null;
      try {
        insertedTrace = await plane.callLogs.insertTrace({
          session_id: insertedLog.id,
          trace_key: traceKey,
          total_spans: (telemetry_data as any).session_traces.length,
          performance_summary: (telemetry_data as any).performance_metrics || {},
          span_summary: (telemetry_data as any).span_summary || {},
          session_start_time: call_started_at,
          session_end_time: call_ended_at,
          total_duration_ms: duration_seconds ? duration_seconds * 1000 : null,
          created_at: new Date().toISOString()
        });
      } catch (e) {
        rethrowDataPlane(e);
        traceError = e;
      }

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

        try {
          await plane.callLogs.insertSpans(spanInserts);
        } catch (spansError) {
          rethrowDataPlane(spansError);
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

      try {
        await plane.callLogs.insertTurns(conversationTurns);
        console.log(`Inserted ${conversationTurns.length} conversation turns`);
      } catch (turnsError) {
        rethrowDataPlane(turnsError);
        console.error('Error inserting conversation turns:', turnsError);
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

      let costError: unknown = null;
      try {
        await plane.callLogs.updateCallLog(insertedLog.id, {
          total_llm_cost: total_llm_cost_inr,
          total_tts_cost: total_tts_cost_inr,
          total_stt_cost: total_stt_cost_inr
        });
      } catch (e) {
        rethrowDataPlane(e);
        costError = e;
      }

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
    const { data: agentConfig, error: agentError } = await createServiceRoleClient()
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

          try {
            await plane.callLogs.setTranscriptionMetrics(insertedLog.id, fpoResult?.logData as Record<string, unknown>);
          } catch (insertFpoError) {
            rethrowDataPlane(insertFpoError);
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
    rethrowDataPlane(error);
    console.error('Send call log error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});


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