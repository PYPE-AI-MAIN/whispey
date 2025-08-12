// Test analytics endpoint to debug overview data
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId') || 'agent_003'
    
    // Get data from JSON file service (server-side)
    const serverData = jsonFileService.readData()
    const agent = serverData.agents.find(a => a.id === agentId)
    const serverCallLogs = serverData.callLogs.filter(c => c.agent_id === agentId)
    
    // Calculate expected analytics
    const totalCalls = serverCallLogs.length
    const completedCalls = serverCallLogs.filter(c => c.call_ended_reason === 'completed').length
    const totalDuration = serverCallLogs.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
    const totalCost = serverCallLogs.reduce((sum, c) => 
      sum + (c.total_stt_cost || 0) + (c.total_tts_cost || 0) + (c.total_llm_cost || 0), 0)
    
    return NextResponse.json({
      success: true,
      agentId,
      agent: agent ? { id: agent.id, name: agent.name, type: agent.agent_type } : null,
      expected_analytics: {
        totalCalls,
        completedCalls,
        totalMinutes: Math.round(totalDuration / 60),
        totalDuration,
        totalCost: totalCost.toFixed(2),
        successRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0
      },
      call_logs: serverCallLogs.map(c => ({
        id: c.id,
        duration_seconds: c.duration_seconds,
        call_ended_reason: c.call_ended_reason,
        costs: {
          stt: c.total_stt_cost,
          tts: c.total_tts_cost,
          llm: c.total_llm_cost,
          total: (c.total_stt_cost || 0) + (c.total_tts_cost || 0) + (c.total_llm_cost || 0)
        }
      })),
      browser_test: {
        instructions: [
          'Open browser console and run:',
          `MockDataService.getAnalytics('${agentId}')`,
          'Compare the result with expected_analytics above'
        ]
      }
    })
  } catch (error) {
    console.error('Test analytics endpoint error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
