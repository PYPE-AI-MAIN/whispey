import crypto from 'crypto';

export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const received = signatureHeader.trim();
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (received === expected) return true;
  if (received.startsWith('v1,')) {
    const receivedSig = received.slice(3).trim();
    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(receivedSig, 'hex');
      return expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }
  const params: Record<string, string> = {};
  received.split(',').forEach((p) => {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
  });
  const t = params.t;
  const sig = params.v1 || params.v0;
  if (t && sig) {
    const signedPayload = t + '.' + rawBody;
    const expected2 = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    try {
      const expectedBuf = Buffer.from(expected2, 'hex');
      const receivedBuf = Buffer.from(sig, 'hex');
      return expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }
  return false;
}

interface TranscriptTurn {
  role: string;
  message?: string;
  conversation_turn_metrics?: { metrics?: Record<string, { elapsed_time?: number }> };
}

function buildTranscriptWithMetrics(transcript: TranscriptTurn[]) {
  const turns: Array<{
    turn_id: string;
    user_transcript: string;
    agent_response: string;
    stt_metrics: object;
    llm_metrics: object;
    tts_metrics: object;
    eou_metrics: object;
    timestamp: null;
  }> = [];
  let turnIndex = 0;
  for (let i = 0; i < transcript.length; i++) {
    const curr = transcript[i];
    const next = transcript[i + 1];
    if (curr.role === 'user' && next?.role === 'agent') {
      const metrics = next.conversation_turn_metrics?.metrics ?? {};
      const llmTtfb = metrics.convai_llm_service_ttfb?.elapsed_time;
      const ttsTtfb = metrics.convai_tts_service_ttfb?.elapsed_time;
      turnIndex += 1;
      turns.push({
        turn_id: `turn_${turnIndex}`,
        user_transcript: curr.message ?? '',
        agent_response: next.message ?? '',
        stt_metrics: {},
        llm_metrics: llmTtfb != null ? { ttft: llmTtfb } : {},
        tts_metrics: ttsTtfb != null ? { ttfb: ttsTtfb } : {},
        eou_metrics: {},
        timestamp: null,
      });
      i++;
    } else if (curr.role === 'agent' && (!next || next.role === 'agent')) {
      const metrics = curr.conversation_turn_metrics?.metrics ?? {};
      const ttsTtfb = metrics.convai_tts_service_ttfb?.elapsed_time;
      turnIndex += 1;
      turns.push({
        turn_id: `turn_${turnIndex}`,
        user_transcript: '',
        agent_response: curr.message ?? '',
        stt_metrics: {},
        llm_metrics: {},
        tts_metrics: ttsTtfb != null ? { ttfb: ttsTtfb } : {},
        eou_metrics: {},
        timestamp: null,
      });
    }
  }
  return turns;
}

export interface ElevenLabsWebhookData {
  type: string;
  event_timestamp?: number;
  data?: {
    conversation_id?: string;
    user_id?: string;
    agent_id?: string;
    metadata?: Record<string, unknown>;
    transcript?: TranscriptTurn[];
    full_audio?: string;
    conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> };
  };
}

export function mapToPypePayload(data: ElevenLabsWebhookData): Record<string, unknown> {
  const d = data.data ?? {};
  const meta = (d.metadata ?? {}) as Record<string, unknown>;
  const startSecs = meta.start_time_unix_secs as number | undefined;
  const durationSecs = (meta.call_duration_secs as number) ?? 0;
  const endSecs = data.event_timestamp ?? (startSecs != null ? startSecs + durationSecs : undefined);
  const transcript = d.transcript ?? [];
  const agentId = process.env.ELEVENLABS_AGENT_ID || d.agent_id;
  const stage = process.env.VERCEL_ENV || process.env.NODE_ENV || 'dev';

  return {
    call_id: d.conversation_id,
    customer_number: d.user_id ?? null,
    agent_id: agentId,
    call_ended_reason: meta.termination_reason ?? null,
    transcript_type: 'elevenlabs',
    transcript_json: transcript.map((t) => ({ role: t.role, message: t.message })),
    metadata: meta,
    dynamic_variables: d.conversation_initiation_client_data?.dynamic_variables ?? {},
    call_started_at: startSecs != null ? new Date(startSecs * 1000).toISOString() : null,
    call_ended_at: endSecs != null ? new Date(endSecs * 1000).toISOString() : null,
    duration_seconds: durationSecs,
    transcript_with_metrics: buildTranscriptWithMetrics(transcript),
    billing_duration_seconds: durationSecs,
    recording_url: null,
    voice_recording_url: null,
    telemetry_data: {},
    environment: stage,
  };
}

export function mapAudioToPypePayload(
  conversationId: string,
  userId: string | null,
  agentId: string | undefined,
  recordingUrl: string,
  s3Bucket: string | null,
  s3Region: string | null,
  callStartedAt: string | null,
  callEndedAt: string | null
): Record<string, unknown> {
  const agentIdEnv = process.env.ELEVENLABS_AGENT_ID || agentId;
  const stage = process.env.VERCEL_ENV || process.env.NODE_ENV || 'dev';

  return {
    call_id: conversationId,
    customer_number: userId ?? null,
    agent_id: agentIdEnv,
    recording_url: recordingUrl,
    voice_recording_url: recordingUrl,
    s3_bucket: s3Bucket,
    s3_region: s3Region,
    transcript_type: 'elevenlabs',
    transcript_json: [],
    transcript_with_metrics: [],
    metadata: {},
    dynamic_variables: {},
    call_started_at: callStartedAt,
    call_ended_at: callEndedAt,
    duration_seconds: 0,
    billing_duration_seconds: 0,
    call_ended_reason: 'completed',
    telemetry_data: {},
    environment: stage,
  };
}
