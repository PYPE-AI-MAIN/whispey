// app/api/logs/call-logs/route.ts - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Extract parameters
    const { 
      agent_id, 
      page = 1, 
      limit = 20,
      search,
      call_status,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = body

    console.log('Fetching call logs with params:', {
      agent_id, page, limit, search, call_status, date_from, date_to, sort_by, sort_order
    })

    if (!agent_id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Verify agent exists
    const agent = MockDataService.getAgentById(agent_id)
    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      )
    }

    // Get call logs from mock data service
    let callLogs = MockDataService.getCallLogs(agent_id)

    // Apply filters
    if (call_status) {
      callLogs = callLogs.filter(log => log.call_ended_reason === call_status)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      callLogs = callLogs.filter(log => 
        log.customer_number.toLowerCase().includes(searchLower) ||
        log.call_id.toLowerCase().includes(searchLower)
      )
    }

    if (date_from) {
      const fromDate = new Date(date_from)
      callLogs = callLogs.filter(log => new Date(log.created_at) >= fromDate)
    }

    if (date_to) {
      const toDate = new Date(date_to)
      callLogs = callLogs.filter(log => new Date(log.created_at) <= toDate)
    }

    // Apply sorting
    callLogs.sort((a, b) => {
      let aValue, bValue

      switch (sort_by) {
        case 'duration_seconds':
          aValue = a.duration_seconds
          bValue = b.duration_seconds
          break
        case 'customer_number':
          aValue = a.customer_number
          bValue = b.customer_number
          break
        case 'call_ended_reason':
          aValue = a.call_ended_reason
          bValue = b.call_ended_reason
          break
        default:
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
      }

      if (sort_order === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    // Apply pagination
    const totalCount = callLogs.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedLogs = callLogs.slice(startIndex, endIndex)

    // Calculate summary statistics
    const totalDuration = callLogs.reduce((sum, log) => sum + log.duration_seconds, 0)
    const completedCalls = callLogs.filter(log => log.call_ended_reason === 'completed').length
    const totalCost = callLogs.reduce((sum, log) => 
      sum + log.total_stt_cost + log.total_tts_cost + log.total_llm_cost, 0
    )

    const response = {
      success: true,
      data: {
        call_logs: paginatedLogs,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount,
          per_page: limit,
          has_next: endIndex < totalCount,
          has_prev: page > 1
        },
        summary: {
          total_calls: totalCount,
          completed_calls: completedCalls,
          success_rate: totalCount > 0 ? Math.round((completedCalls / totalCount) * 100) : 0,
          total_duration_seconds: totalDuration,
          avg_duration_seconds: totalCount > 0 ? Math.round(totalDuration / totalCount) : 0,
          total_cost: Math.round(totalCost * 100) / 100,
          avg_cost: totalCount > 0 ? Math.round((totalCost / totalCount) * 100) / 100 : 0
        }
      }
    }

    console.log(`Returning ${paginatedLogs.length} call logs (page ${page} of ${Math.ceil(totalCount / limit)})`)

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Error fetching call logs:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch call logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}