// Failure Report API - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, date_from, date_to } = body

    if (!agent_id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Verify agent exists
    const agent = jsonFileService.getAgentById(agent_id)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get call logs from JSON file service
    const callLogs = jsonFileService.getCallLogs(agent_id)
    
    // Filter by date range if provided
    let filteredLogs = callLogs
    if (date_from) {
      const fromDate = new Date(date_from)
      filteredLogs = filteredLogs.filter(log => new Date(log.created_at) >= fromDate)
    }
    if (date_to) {
      const toDate = new Date(date_to)
      filteredLogs = filteredLogs.filter(log => new Date(log.created_at) <= toDate)
    }

    // Generate failure report
    const failedCalls = filteredLogs.filter(log => log.call_ended_reason !== 'completed')
    const totalCalls = filteredLogs.length
    const failureRate = totalCalls > 0 ? (failedCalls.length / totalCalls) * 100 : 0

    // Group failures by reason
    const failuresByReason = failedCalls.reduce((acc: any, log) => {
      const reason = log.call_ended_reason || 'unknown'
      if (!acc[reason]) {
        acc[reason] = {
          count: 0,
          examples: []
        }
      }
      acc[reason].count++
      if (acc[reason].examples.length < 5) {
        acc[reason].examples.push({
          call_id: log.call_id,
          customer_number: log.customer_number,
          created_at: log.created_at,
          duration_seconds: log.duration_seconds
        })
      }
      return acc
    }, {})

    // Generate recommendations
    const recommendations = []
    if (failureRate > 20) {
      recommendations.push('High failure rate detected. Consider reviewing agent configuration.')
    }
    if (failuresByReason.timeout?.count > 0) {
      recommendations.push('Multiple timeout failures detected. Consider increasing call timeout limits.')
    }
    if (failuresByReason.busy?.count > 0) {
      recommendations.push('Many busy signals detected. Consider implementing retry logic with delays.')
    }

    const report = {
      summary: {
        total_calls: totalCalls,
        failed_calls: failedCalls.length,
        failure_rate: Math.round(failureRate * 100) / 100,
        success_rate: Math.round((100 - failureRate) * 100) / 100
      },
      failure_breakdown: failuresByReason,
      recommendations,
      date_range: {
        from: date_from || 'N/A',
        to: date_to || 'N/A'
      },
      agent: {
        id: agent.id,
        name: agent.name,
        type: agent.agent_type
      },
      generated_at: new Date().toISOString()
    }

    console.log(`Generated failure report for agent ${agent_id}: ${failedCalls.length}/${totalCalls} failures`)

    return NextResponse.json({
      success: true,
      report
    }, { status: 200 })

  } catch (error) {
    console.error('Error generating failure report:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate failure report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}