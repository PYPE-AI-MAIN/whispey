// app/api/agents/stop_agent/route.ts - CORRECTED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { getPypeApiBaseUrlForServer, type DeploymentTarget } from '@/lib/pypeApiFetch'
import { getCallerGlobalRole } from '@/lib/prod-auth'

export async function POST(request: NextRequest) {
  try {
    // Parse the request body to get the agent_name
    const body = await request.json()
    const { agent_name } = body

    if (!agent_name) {
      return NextResponse.json(
        { error: 'agent_name is required' },
        { status: 400 }
      )
    }

    // POC toggle: which backend this agent lives on. Defaults to 'classic'.
    // Only superadmins may target 'docker' — re-checked here server-side.
    let deploymentTarget: DeploymentTarget = body.deploymentTarget === 'docker' ? 'docker' : 'classic'
    if (deploymentTarget === 'docker') {
      const { userId } = await auth()
      const callerRole = userId ? await getCallerGlobalRole(userId) : 'user'
      if (callerRole !== 'superadmin') {
        deploymentTarget = 'classic'
      }
    }

    const apiUrl = getPypeApiBaseUrlForServer(deploymentTarget)

    if (!apiUrl) {
      console.error(`Voice backend URL is not configured for target '${deploymentTarget}'`)
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      )
    }

    console.log(`Stopping agent: ${agent_name}`)
    // FIXED: Use the correct backend endpoint /stop_agent (not /api/stop_agent)
    console.log(`Proxying request to: ${apiUrl}/stop_agent`)

    // FIXED: Call the correct backend endpoint
    const response = await fetch(`${apiUrl}/stop_agent`, {
      method: 'POST',
      headers: {
        ...serviceAuthHeaders(),
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
        { error: `Failed to stop agent: ${response.status} - ${errorText}` },
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
    console.log('Agent stop response:', data)
    
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Stop agent proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to stop agent', details: error.message },
      { status: 500 }
    )
  }
}