import { NextRequest, NextResponse } from 'next/server'

// TODO: Set ERROR_LOGGER_API_BASE in your .env file
// This should point to your serverless logger API Gateway URL
// Example: https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
const ERROR_LOGGER_API_BASE = process.env.ERROR_LOGGER_API_BASE

if (!ERROR_LOGGER_API_BASE) {
  console.warn('ERROR_LOGGER_API_BASE environment variable is not set. Admin panel error fetching will fail.')
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const agentIds = searchParams.get('agentIds')?.split(',') || []
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const component = searchParams.get('component')
    const errorType = searchParams.get('errorType')
    const limit = searchParams.get('limit') || '100'

    if (!ERROR_LOGGER_API_BASE) {
      return NextResponse.json(
        { error: 'ERROR_LOGGER_API_BASE environment variable is not configured' },
        { status: 500 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    // If specific agents selected, fetch errors for each and aggregate
    if (agentIds.length > 0 && agentIds.filter(id => id.trim()).length > 0) {
      const errorPromises = agentIds.map(async (agentId) => {
        const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/project/${projectId}/agent/${agentId}`)
        url.searchParams.set('date', date)
        if (startTime) url.searchParams.set('startTime', startTime)
        if (endTime) url.searchParams.set('endTime', endTime)
        if (component) url.searchParams.set('component', component)
        if (errorType) url.searchParams.set('errorType', errorType)
        url.searchParams.set('limit', limit)

        try {
          const response = await fetch(url.toString())
          if (!response.ok) {
            console.error(`Failed to fetch errors for agent ${agentId}:`, response.statusText)
            return { agentId, errors: [], count: 0 }
          }
          const data = await response.json()
          return { agentId, errors: data.errors || [], count: data.count || 0 }
        } catch (error) {
          console.error(`Error fetching errors for agent ${agentId}:`, error)
          return { agentId, errors: [], count: 0 }
        }
      })

      const results = await Promise.all(errorPromises)
      const allErrors = results.flatMap(r => r.errors)
      const totalCount = results.reduce((sum, r) => sum + r.count, 0)

      return NextResponse.json({
        projectId,
        agentIds,
        date,
        count: allErrors.length,
        totalCount,
        errors: allErrors,
        byAgent: results.reduce((acc, r) => {
          acc[r.agentId] = { count: r.count, errors: r.errors }
          return acc
        }, {} as Record<string, { count: number; errors: any[] }>)
      })
    } else {
      // Fetch all project errors
      const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/project/${projectId}`)
      url.searchParams.set('date', date)
      if (startTime) url.searchParams.set('startTime', startTime)
      if (endTime) url.searchParams.set('endTime', endTime)
      if (component) url.searchParams.set('component', component)
      if (errorType) url.searchParams.set('errorType', errorType)
      url.searchParams.set('limit', limit)

      const response = await fetch(url.toString())
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch errors' },
          { status: response.status }
        )
      }

      const data = await response.json()
      return NextResponse.json(data)
    }
  } catch (error: any) {
    console.error('Error in admin errors API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

