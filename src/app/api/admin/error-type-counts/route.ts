import { NextRequest, NextResponse } from 'next/server'

const ERROR_LOGGER_API_BASE = process.env.ERROR_LOGGER_API_BASE

// Helper function to validate UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export async function GET(request: NextRequest) {
  try {
    if (!ERROR_LOGGER_API_BASE) {
      return NextResponse.json(
        { error: 'ERROR_LOGGER_API_BASE environment variable is not configured' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const agentIds = searchParams.get('agentIds')?.split(',').filter(id => id.trim()) || []

    // If projectId is 'all' or invalid UUID, we need agentIds to fetch data
    if (!projectId || projectId === 'all' || !isValidUUID(projectId)) {
      if (agentIds.length === 0) {
        // Return empty data structure if no agents selected
        return NextResponse.json({
          projectId: projectId || 'all',
          date,
          totalErrors: 0,
          errorTypeCounts: {}
        })
      }
    }

    // If specific agents, aggregate their error type counts
    if (agentIds.length > 0) {
      const countPromises = agentIds.map(async (agentId) => {
        const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/count/type`)
        // Only add projectId if it's a valid UUID
        if (projectId && projectId !== 'all' && isValidUUID(projectId)) {
          url.searchParams.set('projectId', projectId)
        }
        url.searchParams.set('date', date)
        url.searchParams.set('agentId', agentId)

        try {
          const response = await fetch(url.toString())
          if (!response.ok) {
            console.error(`Failed to fetch error type counts for agent ${agentId}:`, response.status, response.statusText)
            return null
          }
          return response.json()
        } catch (error) {
          console.error(`Error fetching error type counts for agent ${agentId}:`, error)
          return null
        }
      })

      const results = await Promise.all(countPromises)
      const validResults = results.filter(r => r !== null)

      // Aggregate error type counts
      const aggregated: Record<string, number> = {}

      validResults.forEach(result => {
        if (result.errorTypeCounts) {
          Object.entries(result.errorTypeCounts).forEach(([type, count]: [string, any]) => {
            aggregated[type] = (aggregated[type] || 0) + count
          })
        }
      })

      // Sort by count
      const sorted = Object.entries(aggregated)
        .sort((a, b) => b[1] - a[1])
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {} as Record<string, number>)

      return NextResponse.json({
        projectId: projectId || 'all',
        date,
        totalErrors: validResults.reduce((sum, r) => sum + (r.totalErrors || 0), 0),
        errorTypeCounts: sorted
      })
    } else {
      // Fetch project-level error type counts (only if valid UUID)
      if (!projectId || projectId === 'all' || !isValidUUID(projectId)) {
        return NextResponse.json(
          { error: 'Valid projectId or agentIds required' },
          { status: 400 }
        )
      }

      const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/count/type`)
      url.searchParams.set('projectId', projectId)
      url.searchParams.set('date', date)

      const response = await fetch(url.toString())
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch error type counts:', response.status, response.statusText, errorText)
        return NextResponse.json(
          { error: 'Failed to fetch error type counts' },
          { status: response.status }
        )
      }

      return NextResponse.json(await response.json())
    }
  } catch (error: any) {
    console.error('Error in error type counts API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

