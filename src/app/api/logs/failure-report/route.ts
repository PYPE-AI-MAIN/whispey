import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../../lib/supabase';
import { sendResponse } from '../../../../lib/response';
import { verifyToken } from '../../../../lib/auth';
import { FailureReportRequest } from '../../../../types/logs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-pype-token');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendResponse(res, 405, null, 'Method not allowed');
  }

  try {
    const body: FailureReportRequest = req.body;
    const {
      token,
      call_id,
      error_message,
      error_type,
      stack_trace,
      environment = 'development'
    } = body;

    if (!token || !call_id || !error_message) {
      return sendResponse(res, 400, null, 'Token, call_id, and error_message are required');
    }

    // Verify token
    const tokenVerification = await verifyToken(token, environment);
    if (!tokenVerification.valid) {
      return sendResponse(res, 401, null, tokenVerification.error || 'Token verification failed');
    }

    // Create failure report log
    const failureData = {
      call_id,
      call_ended_reason: 'failure',
      transcript_type: 'error',
      transcript_json: {
        error_message,
        error_type,
        stack_trace,
        timestamp: new Date().toISOString()
      },
      metadata: {
        type: 'failure_report',
        reported_at: new Date().toISOString()
      },
      environment,
      created_at: new Date().toISOString()
    };

    const { data: insertedLog, error: insertError } = await supabase
      .from('pype_voice_call_logs')
      .insert(failureData)
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return sendResponse(res, 500, null, 'Failed to save failure report');
    }

    return sendResponse(res, 200, {
      message: 'Failure report saved successfully',
      log_id: insertedLog.id
    });

  } catch (error) {
    console.error('Send failure report error:', error);
    return sendResponse(res, 500, null, 'Internal server error');
  }
}