// src/app/api/reprocess-call-logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Get API base URL from environment
const REPROCESS_API_BASE_URL = process.env.NEXT_PUBLIC_REPROCESS_API_BASE_URL || 
  process.env.NEXT_PUBLIC_PYPEAI_API_URL || 
  'https://xxxxx.execute-api.ap-south-1.amazonaws.com/dev'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if request has a body
    const contentLength = request.headers.get('content-length')
    if (!contentLength || contentLength === '0') {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      )
    }

    // Safely parse JSON
    let body
    try {
      const text = await request.text()
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { error: 'Request body is empty' },
          { status: 400 }
        )
      }
      body = JSON.parse(text)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { 
      from_date, 
      to_date, 
      reprocess_type, 
      reprocess_options, 
      agent_id, 
      project_id,
      transcription_fields,
      metrics_fields
    } = body

    // Validation
    if (!from_date || !to_date) {
      return NextResponse.json(
        { error: 'from_date and to_date are required' },
        { status: 400 }
      )
    }

    if (!reprocess_type || !['empty_only', 'all'].includes(reprocess_type)) {
      return NextResponse.json(
        { error: 'reprocess_type must be "empty_only" or "all"' },
        { status: 400 }
      )
    }

    if (!reprocess_options || !['transcription', 'metrics', 'both'].includes(reprocess_options)) {
      return NextResponse.json(
        { error: 'reprocess_options must be "transcription", "metrics", or "both"' },
        { status: 400 }
      )
    }

    // Validate date format (ISO 8601)
    const fromDate = new Date(from_date)
    const toDate = new Date(to_date)
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format' },
        { status: 400 }
      )
    }

    if (toDate < fromDate) {
      return NextResponse.json(
        { error: 'to_date must be after from_date' },
        { status: 400 }
      )
    }

    // Forward request to Lambda API
    const apiUrl = `${REPROCESS_API_BASE_URL}/reprocess-call-logs`
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from_date,
          to_date,
          reprocess_type,
          reprocess_options,
          agent_id: agent_id || null,
          project_id: project_id || null,
          ...(transcription_fields && Array.isArray(transcription_fields) && transcription_fields.length > 0 && { transcription_fields }),
          ...(metrics_fields && Array.isArray(metrics_fields) && metrics_fields.length > 0 && { metrics_fields })
        })
      })

      if (!response.ok) {
        let errorMessage = 'Failed to trigger reprocess'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Lambda API returned ${response.status}: ${response.statusText}`
        }
        return NextResponse.json(
          { error: errorMessage },
          { status: response.status }
        )
      }

      const data = await response.json()
      return NextResponse.json(data)
    } catch (fetchError) {
      console.error('Error fetching from Lambda API:', fetchError)
      return NextResponse.json(
        { error: `Failed to connect to reprocess API: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` },
        { status: 502 }
      )
    }
  } catch (error) {
    console.error('Reprocess trigger error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

