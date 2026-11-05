import { NextRequest, NextResponse } from 'next/server';
import { withDataPlane, rethrowDataPlane } from '@/server/data-plane';
import { verifyToken } from '../../../../lib/auth';
import { FailureReportRequest } from '../../../../types/logs';

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
    const body: FailureReportRequest = await request.json();
    const {
      token,
      call_id,
      error_message,
      error_type,
      stack_trace,
      environment = 'development'
    } = body;

    if (!token || !call_id || !error_message) {
      return NextResponse.json(
        { success: false, error: 'Token, call_id, and error_message are required' },
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

    // The token names the project, and the project's route names where the log is written.
    const plane = await dp.forProject(tokenVerification.project_id as string);
    let insertedLog;
    try {
      insertedLog = await plane.callLogs.insertCallLog(failureData);
    } catch (insertError) {
      rethrowDataPlane(insertError);
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save failure report' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Failure report saved successfully',
        log_id: insertedLog.id
      }
    }, { status: 200 });

  } catch (error) {
    rethrowDataPlane(error);
    console.error('Send failure report error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});