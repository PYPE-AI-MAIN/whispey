import { NextRequest, NextResponse } from 'next/server'

// TODO: Set ERROR_LOGGER_API_BASE in your .env file
// This should point to your serverless logger API Gateway URL
// Example: https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
const ERROR_LOGGER_API_BASE = process.env.ERROR_LOGGER_API_BASE

if (!ERROR_LOGGER_API_BASE) {
  console.warn('ERROR_LOGGER_API_BASE environment variable is not set. Admin panel recent errors fetching will fail.')
}

// Helper function to validate UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const agentIds = searchParams.get('agentIds')?.split(',') || []
    const component = searchParams.get('component')
    const limit = searchParams.get('limit') || '50'
    const hoursBack = searchParams.get('hoursBack') || '2'

    if (!ERROR_LOGGER_API_BASE) {
      return NextResponse.json(
        { error: 'ERROR_LOGGER_API_BASE environment variable is not configured' },
        { status: 500 }
      )
    }

    // If specific agents selected, fetch recent errors for each and combine
    // This works even without projectId (the /errors/recent endpoint supports agentId alone)
    if (agentIds.length > 0 && agentIds.filter(id => id.trim()).length > 0) {
      const errorPromises = agentIds.map(async (agentId) => {
        const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/recent`)
        // Only add projectId if it's a valid UUID
        if (projectId && projectId !== 'all' && isValidUUID(projectId)) {
          url.searchParams.set('projectId', projectId)
        }
        url.searchParams.set('agentId', agentId)
        if (component) url.searchParams.set('component', component)
        url.searchParams.set('limit', limit)
        url.searchParams.set('hoursBack', hoursBack)

        try {
          const response = await fetch(url.toString())
          if (!response.ok) {
            console.error(`Failed to fetch recent errors for agent ${agentId}:`, response.status, response.statusText)
            return { agentId, errors: [] }
          }
          const data = await response.json()
          return { agentId, errors: data.errors || [] }
        } catch (error) {
          console.error(`Error fetching recent errors for agent ${agentId}:`, error)
          return { agentId, errors: [] }
        }
      })

      const results = await Promise.all(errorPromises)
      const allErrors = results.flatMap(r => r.errors)
      
      // Sort by timestamp descending
      allErrors.sort((a, b) => {
        const timeA = new Date(a.Timestamp || a.timestamp || 0).getTime()
        const timeB = new Date(b.Timestamp || b.timestamp || 0).getTime()
        return timeB - timeA
      })

      // Limit to requested amount
      const limitedErrors = allErrors.slice(0, parseInt(limit))

      return NextResponse.json({
        projectId: projectId || 'all',
        agentIds,
        hoursBack: parseInt(hoursBack),
        count: limitedErrors.length,
        errors: limitedErrors,
        byAgent: results.reduce((acc, r) => {
          acc[r.agentId] = { errors: r.errors }
          return acc
        }, {} as Record<string, { errors: any[] }>)
      })
    } else {
      // Fetch project-level recent errors (only if valid UUID)
      if (!projectId || projectId === 'all' || !isValidUUID(projectId)) {
        return NextResponse.json(
          { error: 'Valid projectId or agentIds required' },
          { status: 400 }
        )
      }

      const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/recent`)
      url.searchParams.set('projectId', projectId)
      if (component) url.searchParams.set('component', component)
      url.searchParams.set('limit', limit)
      url.searchParams.set('hoursBack', hoursBack)

      const response = await fetch(url.toString())
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch recent errors:', response.status, response.statusText, errorText)
        return NextResponse.json(
          { error: 'Failed to fetch recent errors' },
          { status: response.status }
        )
      }

      const data = await response.json()
      return NextResponse.json(data)
    }
  } catch (error: any) {
    console.error('Error in admin recent errors API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

