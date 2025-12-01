// app/api/campaigns/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user (middleware already protects this route)
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
      retryConfig,
    } = body

    // Validation
    if (!campaignId || !startTime || !endTime || !timezone || !frequency || enabled === undefined || !days) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate retry configuration if provided
    if (retryConfig && Array.isArray(retryConfig)) {
      const validCodes = ['480', '486']
      for (const config of retryConfig) {
        // Validate structure
        if (!config.errorCodes || !Array.isArray(config.errorCodes)) {
          return NextResponse.json(
            { error: 'Invalid retry configuration: errorCodes must be an array' },
            { status: 400 }
          )
        }

        // Validate error codes
        for (const code of config.errorCodes) {
          if (!validCodes.includes(code)) {
            return NextResponse.json(
              { error: `Invalid SIP error code: ${code}. Valid codes are: ${validCodes.join(', ')}` },
              { status: 400 }
            )
          }
        }

        // Validate delayMinutes
        if (typeof config.delayMinutes !== 'number' || config.delayMinutes < 0 || config.delayMinutes > 1440) {
          return NextResponse.json(
            { error: 'delayMinutes must be between 0 and 1440' },
            { status: 400 }
          )
        }

        // Validate maxRetries
        if (typeof config.maxRetries !== 'number' || config.maxRetries < 0 || config.maxRetries > 10) {
          return NextResponse.json(
            { error: 'maxRetries must be between 0 and 10' },
            { status: 400 }
          )
        }
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    const apiUrl = `${baseUrl}/api/v1/campaigns/${campaignId}/schedule`

    const requestBody: any = {
      startTime,
      endTime,
      timezone,
      startDate,
      frequency,
      enabled,
      days,
    }

    // Add retry configuration if provided
    if (retryConfig) {
      requestBody.retryConfig = retryConfig
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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