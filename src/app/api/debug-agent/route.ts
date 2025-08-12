// Debug endpoint to check what MockDataService returns for agent_001
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId') || 'agent_001'
    
    // Get data from JSON file service (server-side)
    const serverData = jsonFileService.readData()
    const serverCallLogs = serverData.callLogs.filter(c => c.agent_id === agentId)
    
    return NextResponse.json({
      success: true,
      agentId,
      debug: {
        server_side: {
          total_call_logs: serverData.callLogs.length,
          agent_call_logs: serverCallLogs.length,
          agent_call_ids: serverCallLogs.map(c => c.id)
        }
      },
      instructions: {
        browser_console: [
          'Open browser console and run:',
          `MockDataService.getCallLogs('${agentId}')`,
          'This should return the same call logs'
        ]
      }
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
