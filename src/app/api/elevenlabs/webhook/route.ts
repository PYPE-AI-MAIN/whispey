import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  verifySignature,
  mapToPypePayload,
  mapAudioToPypePayload,
  type ElevenLabsWebhookData,
} from '@/lib/elevenlabs-webhook';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

async function forwardToHost(pypeBody: Record<string, unknown>) {
  const hostUrl = process.env.HOST_URL;
  const token = process.env.WHISPEY_API_KEY;
  if (!hostUrl || !token) return { ok: false, error: 'HOST_URL or WHISPEY_API_KEY not set' };
  const res = await fetch(hostUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-pype-token': token },
    body: JSON.stringify(pypeBody),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function uploadToS3(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  const region = process.env.AWS_REGION || 'ap-south-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get('elevenlabs-signature') ??
      request.headers.get('ElevenLabs-Signature');
    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET ?? '';

    if (!secret) {
      console.error('[ElevenLabs webhook] ELEVENLABS_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    let data: ElevenLabsWebhookData;
    try {
      data = JSON.parse(rawBody) as ElevenLabsWebhookData;
    } catch (err) {
      console.error('[ElevenLabs webhook] Invalid JSON:', err);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    const eventType = data.type;
    const eventTimestamp = data.event_timestamp;

    if (eventType === 'post_call_transcription' && data.data) {
      const pypeBody = mapToPypePayload(data);
      const result = await forwardToHost(pypeBody);
      if (!result.ok) {
        console.error('[ElevenLabs webhook] forwardToHost failed:', result.status, result.body);
      }
    }

    if (eventType === 'post_call_audio' && data.data) {
      const d = data.data;
      const conversationId = d.conversation_id;
      const fullAudioB64 = d.full_audio;
      const bucket = process.env.AWS_S3_BUCKET ?? null;
      const region = process.env.AWS_REGION || 'ap-south-1';

      if (bucket && fullAudioB64 && conversationId) {
        try {
          const bodyBuffer = Buffer.from(fullAudioB64, 'base64');
          const key = `recordings/${conversationId}.mp3`;
          const recordingUrl = await uploadToS3(bucket, key, bodyBuffer, 'audio/mpeg');
          const meta = (d.metadata ?? {}) as Record<string, unknown>;
          const endSecs = eventTimestamp ?? null;
          const durationSecs = (meta.call_duration_secs as number) ?? 0;
          const startSecs = (meta.start_time_unix_secs as number) ?? (endSecs != null && durationSecs > 0 ? endSecs - durationSecs : null);
          const callEndedAt = endSecs != null ? new Date(endSecs * 1000).toISOString() : null;
          const callStartedAt = startSecs != null ? new Date(startSecs * 1000).toISOString() : callEndedAt;
          const pypeBody = mapAudioToPypePayload(
            conversationId,
            d.user_id ?? null,
            d.agent_id,
            recordingUrl,
            bucket,
            region,
            callStartedAt,
            callEndedAt
          );
          const result = await forwardToHost(pypeBody);
          if (!result.ok) {
            console.error('[ElevenLabs webhook] forwardToHost (recording) failed:', result.status, result.body);
          }
        } catch (err) {
          console.error('[ElevenLabs webhook] S3 or forward failed:', err);
        }
      }
    }

    return NextResponse.json({ received: true, type: eventType });
  } catch (err) {
    console.error('[ElevenLabs webhook] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
