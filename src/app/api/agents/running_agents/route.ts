// Create: app/api/agents/running_agents/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.PYPEAI_API_URL
    
    if (!apiUrl) {
      console.error('PYPEAI_API_URL environment variable is not set')
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      )
    }

    console.log(`Fetching running agents from: ${apiUrl}/running_agents`)

    const response = await fetch(`${apiUrl}/running_agents`, {
      method: 'GET',
      headers: {
        'x-api-key': 'pype-api-v1',
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'NextJS-Proxy'
      }
    })

    if (!response.ok) {
      console.error(`Backend API error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: `Failed to fetch running agents: ${response.status}` },
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
    console.log('Running agents response:', data)
    
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Running agents proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch running agents', details: error.message },
      { status: 500 }
    )
  }
}