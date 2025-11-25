import { NextRequest, NextResponse } from 'next/server'

const ERROR_LOGGER_API_BASE = process.env.ERROR_LOGGER_API_BASE

export async function DELETE(request: NextRequest) {
  try {
    if (!ERROR_LOGGER_API_BASE) {
      return NextResponse.json(
        { error: 'ERROR_LOGGER_API_BASE environment variable is not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    const url = `${ERROR_LOGGER_API_BASE}/errors/session/${sessionId}`
    const response = await fetch(url, {
      method: 'DELETE'
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to delete session errors' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, message: 'Session errors deleted successfully' })
  } catch (error: any) {
    console.error('Error in delete session API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

