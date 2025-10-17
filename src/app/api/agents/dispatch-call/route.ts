// src/app/api/agents/dispatch-call/route.ts
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

    // Parse the request body
    const body = await request.json()
    const { agent_name, phone_number } = body

    if (!agent_name) {
      return NextResponse.json(
        { error: 'agent_name is required' },
        { status: 400 }
      )
    }

    if (!phone_number) {
      return NextResponse.json(
        { error: 'phone_number is required' },
        { status: 400 }
      )
    }

    console.log(`Dispatching call: Agent ${agent_name} to ${phone_number}`)
    console.log(`Proxying request to: ${apiUrl}/dispatch_call`)

    // Call the backend /dispatch_call endpoint
    const response = await fetch(`${apiUrl}/dispatch_call`, {
      method: 'POST',
      headers: {
        'x-api-key': 'pype-api-v1',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        agent_name, 
        phone_number 
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Backend API error: ${response.status} ${response.statusText} - ${errorText}`)
      
      // Try to parse error as JSON for better error messages
      let errorMessage = `Failed to dispatch call: ${response.status} - ${errorText}`
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.detail) {
          errorMessage = errorJson.detail
        }
      } catch {
        // Keep the original error message
      }
      
      return NextResponse.json(
        { error: errorMessage },
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