// app/api/agents/start_agent/route.ts - CORRECTED VERSION
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.PYPEAI_API_URL
    
    if (!apiUrl) {
      console.error('PYPEAI_API_URL environment variable is not set')
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      )
    }

    // Parse the request body to get the agent_name
    const body = await request.json()
    const { agent_name } = body

    if (!agent_name) {
      return NextResponse.json(
        { error: 'agent_name is required' },
        { status: 400 }
      )
    }

    console.log(`Starting agent: ${agent_name}`)
    // FIXED: Use the correct backend endpoint /run_agent (not /api/run_agent)
    console.log(`Proxying request to: ${apiUrl}/run_agent`)

    // FIXED: Call the correct backend endpoint
    const response = await fetch(`${apiUrl}/run_agent`, {
      method: 'POST',
      headers: {
        'x-api-key': 'pype-api-v1',
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'NextJS-Proxy'
      },
      body: JSON.stringify({ agent_name })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Backend API error: ${response.status} ${response.statusText} - ${errorText}`)
      return NextResponse.json(
        { error: `Failed to start agent: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await response.text()
      console.error('Non-JSON response from backend:', textResponse.substring(0, 200))
      return NextResponse.json(
        { error: 'Backend returned non-JSON response' },
        { status: 502 }
      )
    }

    const data = await response.json()
    console.log('Agent start response:', data)
    
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Start agent proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to start agent', details: error.message },
      { status: 500 }
    )
  }
}