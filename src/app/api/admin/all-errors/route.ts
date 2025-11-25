import { NextRequest, NextResponse } from 'next/server'

const ERROR_LOGGER_API_BASE = process.env.ERROR_LOGGER_API_BASE

if (!ERROR_LOGGER_API_BASE) {
  console.warn('ERROR_LOGGER_API_BASE environment variable is not set.')
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
    const agentIds = searchParams.get('agentIds')?.split(',').filter(id => id.trim()) || []
    const component = searchParams.get('component')
    const limit = searchParams.get('limit') || '500'
    const hoursBack = searchParams.get('hoursBack') || '24'
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')

    if (agentIds.length === 0) {
      return NextResponse.json(
        { error: 'agentIds parameter is required' },
        { status: 400 }
      )
    }

    console.log(`Fetching errors for ${agentIds.length} agents, hoursBack: ${hoursBack}`)
    
    // Fetch errors for each agent in parallel using the /recent endpoint
      const errorPromises = agentIds.map(async (agentId) => {
        const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/recent`)
        url.searchParams.set('agentId', agentId)
        if (component) url.searchParams.set('component', component)
        url.searchParams.set('limit', limit)
        url.searchParams.set('hoursBack', hoursBack)
        if (startTime) url.searchParams.set('startTime', startTime)
        if (endTime) url.searchParams.set('endTime', endTime)

      try {
        console.log(`Fetching from: ${url.toString()}`)
        const response = await fetch(url.toString())
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Failed to fetch errors for agent ${agentId}:`, response.status, response.statusText, errorText)
          return { agentId, errors: [] }
        }
        
        const data = await response.json()
        console.log(`Agent ${agentId}: Fetched ${data.errors?.length || 0} errors, Response structure:`, Object.keys(data))
        
        return { agentId, errors: data.errors || [] }
      } catch (error) {
        console.error(`Error fetching errors for agent ${agentId}:`, error)
        return { agentId, errors: [] }
      }
    })

    const results = await Promise.all(errorPromises)
    const allErrors = results.flatMap(r => r.errors)
    
    console.log(`Total errors fetched across all agents: ${allErrors.length}`)
    console.log(`Breakdown by agent:`, results.map(r => `${r.agentId}: ${r.errors.length}`))
    
    // Sort by timestamp descending
    allErrors.sort((a, b) => {
      const timeA = new Date(a.Timestamp || a.timestamp || 0).getTime()
      const timeB = new Date(b.Timestamp || b.timestamp || 0).getTime()
      return timeB - timeA
    })

    const response = {
      agentIds,
      hoursBack: parseInt(hoursBack),
      count: allErrors.length,
      errors: allErrors,
      byAgent: results.reduce((acc, r) => {
        acc[r.agentId] = { count: r.errors.length, errors: r.errors }
        return acc
      }, {} as Record<string, { count: number; errors: any[] }>)
    }

    console.log(`Returning response with ${response.count} total errors`)

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error in admin all-errors API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

