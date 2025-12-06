import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get query parameters from the request
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '100'
    
    // Get the base URL from environment variable
    const baseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL || process.env.PYPEAI_API_URL
    
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'API URL not configured' },
        { status: 500 }
      )
    }
    
    // Build the external API URL
    const externalUrl = `${baseUrl}/api/calls/phone-numbers/?limit=${limit}`
    
    // Proxy the request to the external API
    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('External API error:', errorText)
      return NextResponse.json(
        { error: `Failed to fetch phone numbers: ${response.status}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying phone numbers request:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

