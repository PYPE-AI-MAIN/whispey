// app/api/campaigns/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId is required' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    if (!baseUrl) {
      console.error('NEXT_PUBLIC_API_BASE_URL_CAMPAIGN is not set')
      return NextResponse.json(
        { error: 'Campaign API base URL is not configured' },
        { status: 500 }
      )
    }

    const apiUrl = `${baseUrl}/api/v1/campaigns/${campaignId}/stats`

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Check ok before parsing — backend may return non-JSON on gateway errors (502/503)
    if (!response.ok) {
      let errorMessage = 'Failed to fetch campaign stats'
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
      } catch {
        // Non-JSON error body (e.g. HTML from API Gateway) — use default message
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Campaign stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
