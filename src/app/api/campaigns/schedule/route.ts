// app/api/campaigns/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      campaignId,
      startTime,
      endTime,
      timezone,
      startDate,
      frequency,
      enabled,
      days,
    } = body

    // Validation
    if (!campaignId || !startTime || !endTime || !timezone || !frequency || enabled === undefined || !days) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    const apiUrl = `${baseUrl}/api/v1/campaigns/${campaignId}/schedule`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startTime,
        endTime,
        timezone,
        startDate,
        frequency,
        enabled,
        days,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to schedule campaign' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Schedule campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}