import { NextRequest, NextResponse } from 'next/server'

// TODO: Set ERROR_LOGGER_API_BASE in your .env file
// This should point to your serverless logger API Gateway URL
// Example: https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
const ERROR_LOGGER_API_BASE = process.env.ERROR_LOGGER_API_BASE

if (!ERROR_LOGGER_API_BASE) {
  console.warn('ERROR_LOGGER_API_BASE environment variable is not set. Admin panel statistics fetching will fail.')
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const agentIds = searchParams.get('agentIds')?.split(',') || []
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const groupBy = searchParams.get('groupBy') || 'component'

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

    // If specific agents selected, fetch statistics for each and aggregate
    if (agentIds.length > 0 && agentIds.filter(id => id.trim()).length > 0) {
      const statsPromises = agentIds.map(async (agentId) => {
        const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/statistics/project/${projectId}`)
        url.searchParams.set('date', date)
        url.searchParams.set('groupBy', groupBy)
        url.searchParams.set('agentId', agentId)

        try {
          const response = await fetch(url.toString())
          if (!response.ok) {
            console.error(`Failed to fetch statistics for agent ${agentId}:`, response.statusText)
            return { agentId, statistics: {}, totalErrors: 0, uniqueSessions: 0, componentBreakdown: {} }
          }
          const data = await response.json()
          return {
            agentId,
            statistics: data.statistics || {},
            totalErrors: data.totalErrors || 0,
            uniqueSessions: data.uniqueSessions || 0,
            componentBreakdown: data.componentBreakdown || {}
          }
        } catch (error) {
          console.error(`Error fetching statistics for agent ${agentId}:`, error)
          return { agentId, statistics: {}, totalErrors: 0, uniqueSessions: 0, componentBreakdown: {} }
        }
      })

      const results = await Promise.all(statsPromises)
      
      // Aggregate statistics
      const aggregatedStats: Record<string, number> = {}
      let totalErrors = 0
      let uniqueSessions = new Set<string>()
      const componentBreakdown: Record<string, number> = {}

      results.forEach(result => {
        totalErrors += result.totalErrors
        if (result.statistics) {
          Object.entries(result.statistics).forEach(([key, value]) => {
            aggregatedStats[key] = (aggregatedStats[key] || 0) + (value as number)
          })
        }
        if (result.componentBreakdown) {
          Object.entries(result.componentBreakdown).forEach(([component, count]) => {
            componentBreakdown[component] = (componentBreakdown[component] || 0) + (count as number)
          })
        }
      })

      return NextResponse.json({
        projectId,
        agentIds,
        date,
        groupBy,
        totalErrors,
        uniqueSessions: uniqueSessions.size,
        statistics: aggregatedStats,
        componentBreakdown,
        byAgent: results.reduce((acc, r) => {
          acc[r.agentId] = {
            totalErrors: r.totalErrors,
            uniqueSessions: r.uniqueSessions,
            statistics: r.statistics,
            componentBreakdown: r.componentBreakdown
          }
          return acc
        }, {} as Record<string, any>)
      })
    } else {
      // Fetch project-level statistics
      const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/statistics/project/${projectId}`)
      url.searchParams.set('date', date)
      url.searchParams.set('groupBy', groupBy)

      const response = await fetch(url.toString())
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch statistics' },
          { status: response.status }
        )
      }

      const data = await response.json()
      return NextResponse.json(data)
    }
  } catch (error: any) {
    console.error('Error in admin statistics API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

