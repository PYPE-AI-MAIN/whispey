// src/app/api/vapi/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { VapiDataTransformer, type VapiWebhookData, type DBCallData } from '@/lib/vapi-data-transformer';

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming webhook data
    const webhookData: VapiWebhookData = await request.json();

    if (webhookData.message?.type === 'end-of-call-report') {
      const assistantMetadata = webhookData.message?.assistant?.metadata || {};
      const agentId = assistantMetadata.agentId || 'unknown-agent';
      const xPypeToken = assistantMetadata.xPypeToken || null;
      const projectName = assistantMetadata.projectName || '';

      const environment = (process.env.NODE_ENV as 'dev' | 'staging' | 'prod') || 'dev';
      const transformer = new VapiDataTransformer(environment);

      const dbData = transformer.transformVapiToDbFormat(webhookData);

      if (dbData) {
        dbData.metadata = {
          ...dbData.metadata,
          agentId,
          projectName,
          hasToken: !!xPypeToken,
          assistantMetadata: {
            ...assistantMetadata,
            xPypeToken: undefined
          }
        };

        // await Promise.all([
        //   saveRawDataToJson(webhookData, 'raw'),
        //   saveTransformedDataToJson(dbData, 'transformed')
        // ]);

        if (xPypeToken) {
          await sendToPype(dbData, xPypeToken, agentId);
        }
        
      } else {
        // await saveRawDataToJson(webhookData, 'failed');
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook received successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    try {
      // const webhookData = await request.json(); 
      // await saveRawDataToJson(webhookData, 'error');
    } catch (parseError) {
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function sendToPype(dbData: DBCallData, xPypeToken: string, agentId: string) {
  try {
    const pypePayload = {
      call_id: dbData.call_id,
      customer_number: dbData.metadata.customer_number,
      call_started_at: dbData.metadata.call_started_at,
      call_ended_at: dbData.metadata.call_ended_at,
      duration_seconds: dbData.metadata.duration_seconds,
      agent_id: agentId,
      recording_url: dbData.recording_url || '',
      transcript_with_metrics: dbData.transcript_with_metrics,
      call_ended_reason: dbData.call_ended_reason,
      environment: dbData.environment,
      metadata: {
        total_cost: dbData.metadata.total_cost,
        total_duration_seconds: dbData.metadata.total_duration_seconds,
        call_started_at: dbData.metadata.call_started_at,
        call_ended_at: dbData.metadata.call_ended_at,
        call_quality: "good",
        summary: dbData.metadata.summary,
        projectName: dbData.metadata.projectName,
        vapi_call_id: dbData.call_id,
        vapi_assistant_id: dbData.agent_id
      }
    };

    const response = await fetch('https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log', {
      method: 'POST',
      headers: {
        'x-pype-token': xPypeToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(pypePayload)
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`Pype API error: ${response.status} - ${responseText.substring(0, 200)}`);
    }

  } catch (error) {
    throw new Error(`Error sending to Pype: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// async function saveRawDataToJson(webhookData: VapiWebhookData, type: 'raw' | 'failed' | 'error') {
//   try {
//     const tmpDir = path.join(process.cwd(), 'tmp');
//     if (!existsSync(tmpDir)) {
//       await mkdir(tmpDir, { recursive: true });
//     }

//     const sanitizedData = {
//       ...webhookData,
//       message: webhookData.message ? {
//         ...webhookData.message,
//         assistant: webhookData.message.assistant ? {
//           ...webhookData.message.assistant,
//           metadata: webhookData.message.assistant.metadata ? {
//             ...webhookData.message.assistant.metadata,
//             xPypeToken: webhookData.message.assistant.metadata.xPypeToken ? '[REDACTED]' : undefined
//           } : undefined
//         } : undefined
//       } : undefined
//     };

//     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//     const uuid = randomUUID();
//     const callId = webhookData.message?.call?.id || 'no-id';
//     const fileName = `vapi-${type}-${timestamp}-${callId}-${uuid.slice(0, 8)}.json`;
    
//     const filePath = path.join(tmpDir, fileName);
//     await writeFile(filePath, JSON.stringify(sanitizedData, null, 2), 'utf-8');
    
//   } catch (error) {
//   }
// }

async function saveTransformedDataToJson(dbData: DBCallData, type: 'transformed') {
  try {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = randomUUID();
    const callId = dbData.call_id || 'no-id';
    const fileName = `vapi-${type}-${timestamp}-${callId}-${uuid.slice(0, 8)}.json`;
    
    const filePath = path.join(tmpDir, fileName);
    await writeFile(filePath, JSON.stringify(dbData, null, 2), 'utf-8');
    
  } catch (error) {
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'VAPI Webhook endpoint is running',
    method: 'POST',
    path: '/api/vapi/webhook'
  });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}