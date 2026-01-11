/**
 * API Route: Backfill Final Disposition
 * 
 * This endpoint processes call logs within a date range and calculates
 * final_disposition using a Lambda function, then updates the transcription_metrics
 * JSONB field in the database.
 * 
 * Flow:
 * 1. Authenticate user
 * 2. Validate input (date range, agent_id, project_id)
 * 3. Fetch call logs from Supabase
 * 4. Process in batches of 10
 * 5. Call Lambda batch API
 * 6. Update transcription_metrics with final_disposition
 * 7. Return progress and results
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// Configuration
// ============================================================================

// Lambda API Gateway URL - should be set in environment variables
const DISPOSITION_LAMBDA_URL = 
  process.env.NEXT_PUBLIC_DISPOSITION_LAMBDA_URL || 
  process.env.DISPOSITION_LAMBDA_URL || 
  ''

// Batch size for processing (10 rows at a time as requested)
const BATCH_SIZE = 10

// Database update batch size (to respect Supabase rate limits)
const DB_UPDATE_BATCH_SIZE = 50

// ============================================================================
// Supabase Client Initialization
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================================================================
// Type Definitions
// ============================================================================

interface BackfillRequest {
  from_date: string
  to_date: string
  agent_id: string
  project_id?: string
  overwrite_existing?: boolean // If true, overwrite existing final_disposition values
}

interface CallLogRow {
  id: string
  agent_id: string
  transcription_metrics?: Record<string, any> | null
  metadata?: Record<string, any> | null
}

interface LambdaBatchRequest {
  call_logs: Array<{
    call_log_id: string
    transcription_metrics: Record<string, any>
    metadata: Record<string, any>
  }>
}

interface LambdaBatchResponse {
  success: boolean
  results: Array<{
    call_log_id: string
    final_disposition: string
    success: boolean
  }>
  summary: {
    total: number
    successful: number
    errors: number
  }
}

interface BackfillResult {
  call_log_id: string
  final_disposition: string | null
  success: boolean
  skipped?: boolean
  error?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates the request body
 */
function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body.from_date || !body.to_date) {
    return { valid: false, error: 'from_date and to_date are required' }
  }

  if (!body.agent_id) {
    return { valid: false, error: 'agent_id is required' }
  }

  // Validate date format
  const fromDate = new Date(body.from_date)
  const toDate = new Date(body.to_date)

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return { valid: false, error: 'Invalid date format. Use ISO 8601 format' }
  }

  if (toDate < fromDate) {
    return { valid: false, error: 'to_date must be after from_date' }
  }

  return { valid: true }
}

/**
 * Fetches call logs from Supabase within date range
 * Optionally filters out logs that already have final_disposition
 */
async function fetchCallLogs(
  agentId: string,
  projectId: string | undefined,
  fromDate: Date,
  toDate: Date,
  skipExisting: boolean = false
): Promise<{ logs: CallLogRow[]; error?: string }> {
  try {
    // Build base query
    let query = supabase
      .from('pype_voice_call_logs')
      .select('id, agent_id, transcription_metrics, metadata')
      .eq('agent_id', agentId)
      .gte('call_started_at', fromDate.toISOString())
      .lte('call_started_at', toDate.toISOString())
      .order('call_started_at', { ascending: true })

    // If project_id is provided, validate agent belongs to project
    if (projectId) {
      const { data: agent, error: agentError } = await supabase
        .from('pype_voice_agents')
        .select('id, project_id')
        .eq('id', agentId)
        .eq('project_id', projectId)
        .single()

      if (agentError || !agent) {
        return { logs: [], error: 'Agent not found or does not belong to project' }
      }
    }

    // Fetch all logs (we'll paginate if needed)
    const { data, error } = await query

    if (error) {
      console.error('Error fetching call logs:', error)
      return { logs: [], error: `Failed to fetch call logs: ${error.message}` }
    }

    let logs = data || []

    // If skipExisting is true, filter out logs that already have final_disposition
    if (skipExisting) {
      logs = logs.filter(log => {
        const transcriptionMetrics = log.transcription_metrics || {}
        return !transcriptionMetrics.final_disposition
      })
      console.log(`Filtered out ${(data?.length || 0) - logs.length} logs that already have final_disposition`)
    }

    return { logs }
  } catch (error) {
    console.error('Unexpected error fetching call logs:', error)
    return {
      logs: [],
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Extracts only the fields needed by Lambda for disposition calculation
 * Lambda only needs:
 * - transcription_metrics: is_confirmation, is_cancellation_transfer, is_reschedule_transfer, is_user_busy, is_wrong_number
 * - metadata: transfer_call_initiated
 */
function extractLambdaFields(log: CallLogRow) {
  const transcriptionMetrics = log.transcription_metrics || {}
  const metadata = log.metadata || {}
  
  // Only include fields that Lambda actually uses
  const filteredTranscriptionMetrics: Record<string, any> = {}
  const lambdaTranscriptionFields = [
    'is_confirmation',
    'is_cancellation_transfer',
    'is_reschedule_transfer',
    'is_user_busy',
    'is_wrong_number'
  ]
  
  lambdaTranscriptionFields.forEach(field => {
    if (field in transcriptionMetrics) {
      filteredTranscriptionMetrics[field] = transcriptionMetrics[field]
    }
  })
  
  // Only include transfer_call_initiated from metadata
  const filteredMetadata: Record<string, any> = {}
  if ('transfer_call_initiated' in metadata) {
    filteredMetadata.transfer_call_initiated = metadata.transfer_call_initiated
  }
  
  return {
    call_log_id: log.id,
    transcription_metrics: filteredTranscriptionMetrics,
    metadata: filteredMetadata
  }
}

/**
 * Calls Lambda batch API to calculate dispositions
 */
async function callLambdaBatch(
  batch: CallLogRow[]
): Promise<{ success: boolean; results: BackfillResult[]; error?: string }> {
  try {
    // Prepare Lambda payload with only necessary fields
    const lambdaPayload: LambdaBatchRequest = {
      call_logs: batch.map(extractLambdaFields)
    }

    // Call Lambda API
    const response = await fetch(DISPOSITION_LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(lambdaPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Lambda API error:', response.status, errorText)
      return {
        success: false,
        results: [],
        error: `Lambda API returned ${response.status}: ${errorText}`
      }
    }

    const lambdaResponse: LambdaBatchResponse = await response.json()

    if (!lambdaResponse.success) {
      return {
        success: false,
        results: [],
        error: 'Lambda processing failed'
      }
    }

    // Map Lambda results to our format
    const results: BackfillResult[] = lambdaResponse.results.map(result => ({
      call_log_id: result.call_log_id,
      final_disposition: result.final_disposition,
      success: result.success
    }))

    return { success: true, results }
  } catch (error) {
    console.error('Error calling Lambda API:', error)
    return {
      success: false,
      results: [],
      error: `Failed to call Lambda: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Updates transcription_metrics in database with final_disposition
 * Merges final_disposition into existing transcription_metrics JSONB
 * 
 * If final_disposition already exists, it will be overwritten (recalculated)
 */
async function updateTranscriptionMetrics(
  callLogId: string,
  finalDisposition: string,
  overwriteExisting: boolean = true
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    // First, fetch current transcription_metrics
    const { data: currentLog, error: fetchError } = await supabase
      .from('pype_voice_call_logs')
      .select('transcription_metrics')
      .eq('id', callLogId)
      .single()

    if (fetchError) {
      console.error(`Error fetching log ${callLogId}:`, fetchError)
      return { success: false, error: fetchError.message }
    }

    const existingMetrics = currentLog?.transcription_metrics || {}
    
    // Check if final_disposition already exists
    if (!overwriteExisting && existingMetrics.final_disposition) {
      console.log(`Skipping ${callLogId} - final_disposition already exists: ${existingMetrics.final_disposition}`)
      return { success: true, skipped: true }
    }

    // Merge final_disposition into existing transcription_metrics
    // This will overwrite if it already exists
    const updatedMetrics = {
      ...existingMetrics,
      final_disposition: finalDisposition
    }

    // Update the record
    const { error: updateError } = await supabase
      .from('pype_voice_call_logs')
      .update({ transcription_metrics: updatedMetrics })
      .eq('id', callLogId)

    if (updateError) {
      console.error(`Error updating log ${callLogId}:`, updateError)
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    console.error(`Unexpected error updating log ${callLogId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Processes a batch of call logs
 */
async function processBatch(
  batch: CallLogRow[],
  overwriteExisting: boolean = true
): Promise<BackfillResult[]> {
  // Call Lambda to get dispositions
  const lambdaResult = await callLambdaBatch(batch)

  if (!lambdaResult.success || !lambdaResult.results.length) {
    // If Lambda fails, mark all as failed
    return batch.map(log => ({
      call_log_id: log.id,
      final_disposition: null,
      success: false,
      error: lambdaResult.error || 'Lambda processing failed'
    }))
  }

  // Update database for each successful result
  const updatePromises = lambdaResult.results.map(async result => {
    if (!result.success || !result.final_disposition) {
      return result
    }

    const updateResult = await updateTranscriptionMetrics(
      result.call_log_id,
      result.final_disposition,
      overwriteExisting
    )

    if (updateResult.skipped) {
      return {
        ...result,
        success: true,
        skipped: true
      }
    }

    if (!updateResult.success) {
      return {
        ...result,
        success: false,
        error: updateResult.error || 'Database update failed'
      }
    }

    return result
  })

  return await Promise.all(updatePromises)
}

// ============================================================================
// Main API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    let body: BackfillRequest
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate request
    const validation = validateRequest(body)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Check if Lambda URL is configured
    if (!DISPOSITION_LAMBDA_URL) {
      return NextResponse.json(
        { error: 'Lambda API URL not configured. Please set DISPOSITION_LAMBDA_URL environment variable.' },
        { status: 500 }
      )
    }

    // Parse dates
    const fromDate = new Date(body.from_date)
    const toDate = new Date(body.to_date)
    // If overwrite_existing is explicitly false, skip existing values
    // Default behavior: overwrite existing (overwrite_existing defaults to true if not specified)
    const overwriteExisting = body.overwrite_existing !== false
    const skipExisting = !overwriteExisting // If overwrite_existing is false, skip existing

    // Fetch call logs
    console.log(`Fetching call logs for agent ${body.agent_id} from ${fromDate.toISOString()} to ${toDate.toISOString()}`)
    if (skipExisting) {
      console.log('Skipping logs that already have final_disposition')
    } else {
      console.log('Overwriting existing final_disposition values')
    }
    
    const { logs, error: fetchError } = await fetchCallLogs(
      body.agent_id,
      body.project_id,
      fromDate,
      toDate,
      skipExisting
    )

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError },
        { status: 500 }
      )
    }

    if (logs.length === 0) {
      return NextResponse.json({
        success: true,
        total_processed: 0,
        successful: 0,
        failed: 0,
        results: [],
        message: 'No call logs found in the specified date range'
      })
    }

    console.log(`Found ${logs.length} call logs to process`)

    // Process logs in batches of 10
    const allResults: BackfillResult[] = []
    const totalBatches = Math.ceil(logs.length / BATCH_SIZE)

    for (let i = 0; i < logs.length; i += BATCH_SIZE) {
      const batch = logs.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1

      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} logs)`)

      try {
        const batchResults = await processBatch(batch, overwriteExisting)
        allResults.push(...batchResults)

        // Small delay between batches to avoid overwhelming the system
        if (i + BATCH_SIZE < logs.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Error processing batch ${batchNumber}:`, error)
        // Mark all logs in this batch as failed
        batch.forEach(log => {
          allResults.push({
            call_log_id: log.id,
            final_disposition: null,
            success: false,
            error: error instanceof Error ? error.message : 'Batch processing error'
          })
        })
      }
    }

    // Calculate summary
    const successful = allResults.filter(r => r.success && !r.skipped).length
    const skipped = allResults.filter(r => r.skipped).length
    const failed = allResults.filter(r => !r.success).length

    console.log(`Backfill complete: ${successful} successful, ${skipped} skipped, ${failed} failed out of ${logs.length} total`)

    return NextResponse.json({
      success: true,
      total_processed: logs.length,
      successful,
      skipped,
      failed,
      results: allResults
    })
  } catch (error) {
    console.error('Backfill disposition error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

