// src/app/api/agents/dispatch-call/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectIdFromAgentBackendName, isViewerForProject } from '@/lib/getProjectRoleForApi'
import { serviceAuthHeaders } from '@/lib/serviceToken'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiUrl = process.env.PYPEAI_API_URL
    
    if (!apiUrl) {
      console.error('PYPEAI_API_URL environment variable is not set')
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      )
    }

    // Parse the request body
    const body = await request.json()
    const { agent_name, phone_number, sip_trunk_id, provider, number_type, from_number, variables } = body

    if (!agent_name) {
      return NextResponse.json({ error: 'agent_name is required' }, { status: 400 })
    }

    const projectId = await getProjectIdFromAgentBackendName(agent_name)
    if (!projectId) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    if (await isViewerForProject(projectId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!phone_number) {
      return NextResponse.json({ error: 'phone_number is required' }, { status: 400 })
    }

    const isBridge = number_type === 'acefone_bridge' || number_type === 'plivo_bridge'

    if (!isBridge && !sip_trunk_id) {
      return NextResponse.json({ error: 'sip_trunk_id is required' }, { status: 400 })
    }

    // Bridge outbound — hit the bridge directly
    if (isBridge) {
      const bridgeUrl = process.env.BRIDGE_URL
      if (!bridgeUrl) {
        return NextResponse.json({ error: 'BRIDGE_URL not configured' }, { status: 500 })
      }

      const bridgeEndpoint = number_type === 'acefone_bridge'
        ? `${bridgeUrl}/outbound/acefone`
        : `${bridgeUrl}/outbound/plivo`

      console.log(`Bridge outbound: Agent ${agent_name} to ${phone_number} via ${bridgeEndpoint}`)

      try {
        const response = await fetch(bridgeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_name,
            to: phone_number,
            from: from_number,
            ...(variables && Object.keys(variables).length > 0 ? { variables } : {}),
          }),
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          return NextResponse.json({ error: errorText }, { status: response.status })
        }

        const data = await response.json().catch(() => ({ status: 'dispatched' }))
        return NextResponse.json(data)
      } catch (bridgeErr: any) {
        // Bridge closes the socket after accepting the call — treat as success
        if (bridgeErr?.cause?.code === 'UND_ERR_SOCKET') {
          console.log('Bridge closed socket after dispatch (expected) — treating as success')
          return NextResponse.json({ status: 'dispatched' })
        }
        throw bridgeErr
      }
    }

    // SIP path
    if (!provider) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 })
    }

    console.log(`Dispatching call: Agent ${agent_name} to ${phone_number}`)
    console.log(`SIP Trunk ID: ${sip_trunk_id}, Provider: ${provider}`)
    console.log(`Proxying request to: ${apiUrl}/dispatch_call`)

    // Call the backend /dispatch_call endpoint
    const response = await fetch(`${apiUrl}/dispatch_call`, {
      method: 'POST',
      headers: {
        ...serviceAuthHeaders(),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_name,
        phone_number,
        sip_trunk_id,
        provider,
        ...(variables && Object.keys(variables).length > 0 ? { variables } : {}),
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Backend API error: ${response.status} ${response.statusText} - ${errorText}`)
      
      // Try to parse error as JSON for better error messages
      let errorMessage = `Failed to dispatch call`
      let errorDetails: any = {}
      
      try {
        const errorJson = JSON.parse(errorText)
        
        // Handle 429 rate limit errors specifically
        if (response.status === 429) {
          errorMessage = errorJson.message || errorJson.detail || 'Rate limit exceeded. Please try again later.'
          if (errorJson.current_calls !== undefined && errorJson.max_calls !== undefined) {
            errorDetails = {
              message: errorMessage,
              current_calls: errorJson.current_calls,
              max_calls: errorJson.max_calls
            }
            errorMessage = `Rate limit exceeded. Current calls: ${errorJson.current_calls}/${errorJson.max_calls}. Please try again later.`
          }
        } else {
          // Handle other errors
          errorMessage = errorJson.message || errorJson.detail || errorJson.error || errorMessage
          if (errorJson.detail) {
            errorDetails = { detail: errorJson.detail }
          }
        }
      } catch {
        // If not JSON, use the text as error message
        if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again later.'
        } else {
          errorMessage = errorText || errorMessage
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          ...errorDetails,
          status: response.status
        },
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
    console.log('Dispatch call response:', data)
    
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Dispatch call proxy error:', error)
    
    // Handle different types of errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Unable to connect to voice agent service' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to dispatch call', details: error.message },
      { status: 500 }
    )
  }
}