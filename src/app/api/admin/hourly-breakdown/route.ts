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
        const emptyBreakdown: Record<string, any> = {}
        for (let i = 0; i < 24; i++) {
          const hour = i.toString().padStart(2, '0')
          emptyBreakdown[hour] = {
            total: 0,
            byComponent: { stt: 0, llm: 0, tts: 0, sip: 0, server: 0 }
          }
        }
        return NextResponse.json({
          projectId: projectId || 'all',
          date,
          totalErrors: 0,
          hourlyBreakdown: emptyBreakdown
        })
      }
    }

    // If specific agents, aggregate their hourly data
    if (agentIds.length > 0) {
      const breakdownPromises = agentIds.map(async (agentId) => {
        const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/hourly`)
        // Only add projectId if it's a valid UUID
        if (projectId && projectId !== 'all' && isValidUUID(projectId)) {
          url.searchParams.set('projectId', projectId)
        }
        url.searchParams.set('date', date)
        url.searchParams.set('agentId', agentId)

        try {
          const response = await fetch(url.toString())
          if (!response.ok) {
            console.error(`Failed to fetch hourly breakdown for agent ${agentId}:`, response.status, response.statusText)
            return null
          }
          return response.json()
        } catch (error) {
          console.error(`Error fetching hourly breakdown for agent ${agentId}:`, error)
          return null
        }
      })

      const results = await Promise.all(breakdownPromises)
      const validResults = results.filter(r => r !== null)

      // Aggregate hourly breakdowns
      const aggregated: Record<string, any> = {}
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0')
        aggregated[hour] = {
          total: 0,
          byComponent: { stt: 0, llm: 0, tts: 0, sip: 0, server: 0 }
        }
      }

      validResults.forEach(result => {
        if (result.hourlyBreakdown) {
          Object.entries(result.hourlyBreakdown).forEach(([hour, data]: [string, any]) => {
            aggregated[hour].total += data.total || 0
            Object.keys(data.byComponent || {}).forEach(comp => {
              aggregated[hour].byComponent[comp] += data.byComponent[comp] || 0
            })
          })
        }
      })

      return NextResponse.json({
        projectId: projectId || 'all',
        date,
        totalErrors: validResults.reduce((sum, r) => sum + (r.totalErrors || 0), 0),
        hourlyBreakdown: aggregated
      })
    } else {
      // Fetch project-level hourly breakdown (only if valid UUID)
      if (!projectId || projectId === 'all' || !isValidUUID(projectId)) {
        return NextResponse.json(
          { error: 'Valid projectId or agentIds required' },
          { status: 400 }
        )
      }

      const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/hourly`)
      url.searchParams.set('projectId', projectId)
      url.searchParams.set('date', date)

      const response = await fetch(url.toString())
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch hourly breakdown:', response.status, response.statusText, errorText)
        return NextResponse.json(
          { error: 'Failed to fetch hourly breakdown' },
          { status: response.status }
        )
      }

      return NextResponse.json(await response.json())
    }
  } catch (error: any) {
    console.error('Error in hourly breakdown API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

