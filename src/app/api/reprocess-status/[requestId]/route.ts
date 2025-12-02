// src/app/api/reprocess-status/[requestId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Get API base URL from environment
const REPROCESS_API_BASE_URL = process.env.NEXT_PUBLIC_REPROCESS_API_BASE_URL

console.log("REPROCESS_API_BASE_URL", REPROCESS_API_BASE_URL);
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId } = await params

    if (!requestId) {
      return NextResponse.json(
        { error: 'request_id is required' },
        { status: 400 }
      )
    }

    // Forward request to Lambda API
    const apiUrl = `${REPROCESS_API_BASE_URL}/reprocess-status/${requestId}`
    
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        let errorMessage = 'Failed to get reprocess status'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
            console.log("errorData", errorData)
        } catch {
          errorMessage = `Lambda API returned ${response.status}: ${response.statusText}`
          console.log("errorMessage", errorMessage)
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
    console.error('Reprocess status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

