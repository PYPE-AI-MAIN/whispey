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
      const validCodes = ['480', '486'] // Only allow 480 and 486
      
      for (const config of retryConfig) {
        const retryType = config.type || 'sipCode' // Default to sipCode if type not specified
        
        // Common validations for all types
        if (typeof config.delayMinutes !== 'number' || config.delayMinutes < 0 || config.delayMinutes > 1440) {
          return NextResponse.json(
            { error: 'delayMinutes must be between 0 and 1440' },
            { status: 400 }
          )
        }

        if (typeof config.maxRetries !== 'number' || config.maxRetries < 0 || config.maxRetries > 10) {
          return NextResponse.json(
            { error: 'maxRetries must be between 0 and 10' },
            { status: 400 }
          )
        }

        // Type-specific validations
        if (retryType === 'sipCode') {
          // SIP Code retry: errorCodes is required
          if (!config.errorCodes || !Array.isArray(config.errorCodes)) {
            return NextResponse.json(
              { error: 'Invalid retry configuration: errorCodes must be an array for SIP code retries' },
              { status: 400 }
            )
          }

          if (config.errorCodes.length === 0) {
            return NextResponse.json(
              { error: 'Invalid retry configuration: errorCodes array cannot be empty' },
              { status: 400 }
            )
          }

          // Validate error codes
          for (const code of config.errorCodes) {
            const codeStr = String(code).trim()
            if (!validCodes.includes(codeStr)) {
              return NextResponse.json(
                { error: `Invalid SIP error code: ${codeStr}. Valid codes are: ${validCodes.join(', ')}` },
                { status: 400 }
              )
            }
          }

          // Ensure errorCodes is an array of strings or numbers
          if (!config.errorCodes.every((code: string | number) => typeof code === 'string' || typeof code === 'number')) {
            return NextResponse.json(
              { error: 'Invalid retry configuration: errorCodes must be an array of strings or numbers' },
              { status: 400 }
            )
          }
        } else if (retryType === 'metric') {
          // Metric retry: errorCodes should NOT be present
          if (config.errorCodes !== undefined) {
            return NextResponse.json(
              { error: 'Invalid retry configuration: errorCodes should not be present for metric retries' },
              { status: 400 }
            )
          }

          // Validate metric-specific fields
          if (!config.metricName || typeof config.metricName !== 'string' || config.metricName.trim() === '') {
            return NextResponse.json(
              { error: 'Invalid retry configuration: metricName is required for metric retries' },
              { status: 400 }
            )
          }

          const validOperators = ['<', '>', '<=', '>=', '==', '!=']
          if (!config.operator || !validOperators.includes(config.operator)) {
            return NextResponse.json(
              { error: `Invalid retry configuration: operator must be one of: ${validOperators.join(', ')}` },
              { status: 400 }
            )
          }

          if (typeof config.threshold !== 'number') {
            return NextResponse.json(
              { error: 'Invalid retry configuration: threshold must be a number for metric retries' },
              { status: 400 }
            )
          }
        } else if (retryType === 'fieldExtractor') {
          // Field Extractor retry: errorCodes should NOT be present
          if (config.errorCodes !== undefined) {
            return NextResponse.json(
              { error: 'Invalid retry configuration: errorCodes should not be present for field extractor retries' },
              { status: 400 }
            )
          }

          // Validate field extractor-specific fields
          if (!config.fieldName || typeof config.fieldName !== 'string' || config.fieldName.trim() === '') {
            return NextResponse.json(
              { error: 'Invalid retry configuration: fieldName is required for field extractor retries' },
              { status: 400 }
            )
          }

          const validOperators = ['missing', 'equals', 'not_equals', 'contains', 'not_contains']
          if (!config.operator || !validOperators.includes(config.operator)) {
            return NextResponse.json(
              { error: `Invalid retry configuration: operator must be one of: ${validOperators.join(', ')}` },
              { status: 400 }
            )
          }

          // expectedValue is required if operator is not 'missing'
          if (config.operator !== 'missing' && (!config.expectedValue || config.expectedValue === '')) {
            return NextResponse.json(
              { error: 'Invalid retry configuration: expectedValue is required when operator is not "missing"' },
              { status: 400 }
            )
          }
        } else {
          return NextResponse.json(
            { error: `Invalid retry configuration: unknown retry type "${retryType}". Valid types are: sipCode, metric, fieldExtractor` },
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