import { NextRequest, NextResponse } from 'next/server'

const ERROR_LOGGER_API_BASE = process.env.ERROR_LOGGER_API_BASE

// Helper function to validate and sanitize customer number
function sanitizeCustomerNumber(customerNumber: string): string {
  // Trim whitespace and remove any invalid characters
  // Customer number should be alphanumeric with optional hyphens or underscores
  return customerNumber.trim().replace(/[^a-zA-Z0-9_-]/g, '')
}

export async function GET(request: NextRequest) {
  try {
    if (!ERROR_LOGGER_API_BASE) {
      return NextResponse.json(
        { error: 'ERROR_LOGGER_API_BASE environment variable is not configured' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    let customerNumber = searchParams.get('customerNumber')
    const date = searchParams.get('date')
    const projectId = searchParams.get('projectId')
    const agentId = searchParams.get('agentId')
    const limit = searchParams.get('limit') || '100'

    if (!customerNumber) {
      return NextResponse.json(
        { error: 'customerNumber parameter is required' },
        { status: 400 }
      )
    }

    // Sanitize customer number (trim and remove invalid characters)
    customerNumber = sanitizeCustomerNumber(customerNumber)

    if (!customerNumber) {
      return NextResponse.json(
        { error: 'Invalid customerNumber format. Must be alphanumeric with optional hyphens or underscores.' },
        { status: 400 }
      )
    }

    // URL encode the customer number to handle special characters properly
    const encodedCustomerNumber = encodeURIComponent(customerNumber)
    const url = new URL(`${ERROR_LOGGER_API_BASE}/errors/customer/${encodedCustomerNumber}`)
    if (date) url.searchParams.set('date', date)
    if (projectId) url.searchParams.set('projectId', projectId)
    if (agentId) url.searchParams.set('agentId', agentId)
    url.searchParams.set('limit', limit)

    console.log(`Fetching customer errors for: ${customerNumber} (encoded: ${encodedCustomerNumber})`)
    console.log(`Full URL: ${url.toString()}`)

    const response = await fetch(url.toString())
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to fetch customer errors:', response.status, response.statusText, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch customer errors', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Calculate statistics
    const errors = data.errors || []
    const uniqueSessions = new Set(errors.map((e: any) => e.SessionId)).size
    const componentBreakdown: Record<string, number> = {}
    
    errors.forEach((error: any) => {
      if (error.Component) {
        componentBreakdown[error.Component] = (componentBreakdown[error.Component] || 0) + 1
      }
    })

    return NextResponse.json({
      ...data,
      totalErrors: errors.length,
      uniqueSessions,
      componentBreakdown
    })
  } catch (error: any) {
    console.error('Error in customer errors API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

