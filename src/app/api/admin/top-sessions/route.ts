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
    const limit = searchParams.get('limit') || '20'

    // If projectId is 'all' or invalid UUID, we need agentIds to fetch data
    if (!projectId || projectId === 'all' || !isValidUUID(projectId)) {
      if (agentIds.length === 0) {
        // Return empty data structure if no agents selected
        return NextResponse.json({
          projectId: projectId || 'all',
          date,
          topSessions: []
        })
      }
    }

    // If specific agents, aggregate their top sessions
    if (agentIds.length > 0) {
      const sessionPromises = agentIds.map(async (agentId) => {
        const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/top-sessions`)
        // Only add projectId if it's a valid UUID
        if (projectId && projectId !== 'all' && isValidUUID(projectId)) {
          url.searchParams.set('projectId', projectId)
        }
        url.searchParams.set('date', date)
        url.searchParams.set('agentId', agentId)
        url.searchParams.set('limit', limit)

        try {
          const response = await fetch(url.toString())
          if (!response.ok) {
            console.error(`Failed to fetch top sessions for agent ${agentId}:`, response.status, response.statusText)
            return null
          }
          return response.json()
        } catch (error) {
          console.error(`Error fetching top sessions for agent ${agentId}:`, error)
          return null
        }
      })

      const results = await Promise.all(sessionPromises)
      const validResults = results.filter(r => r !== null)

      // Combine and sort all sessions
      const allSessions = validResults.flatMap(r => r.topSessions || [])
      allSessions.sort((a: any, b: any) => b.errorCount - a.errorCount)

      return NextResponse.json({
        projectId: projectId || 'all',
        date,
        topSessions: allSessions.slice(0, parseInt(limit))
      })
    } else {
      // Fetch project-level top sessions (only if valid UUID)
      if (!projectId || projectId === 'all' || !isValidUUID(projectId)) {
        return NextResponse.json(
          { error: 'Valid projectId or agentIds required' },
          { status: 400 }
        )
      }

      const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/top-sessions`)
      url.searchParams.set('projectId', projectId)
      url.searchParams.set('date', date)
      url.searchParams.set('limit', limit)

      const response = await fetch(url.toString())
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch top sessions:', response.status, response.statusText, errorText)
        return NextResponse.json(
          { error: 'Failed to fetch top sessions' },
          { status: response.status }
        )
      }

      return NextResponse.json(await response.json())
    }
  } catch (error: any) {
    console.error('Error in top sessions API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

