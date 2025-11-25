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
    const { type, projectId, agentId, sessionId, date, daysOld } = body

    let url: string
    let params: URLSearchParams | null = null

    switch (type) {
      case 'project':
        if (!projectId || !date) {
          return NextResponse.json(
            { error: 'projectId and date are required for project deletion' },
            { status: 400 }
          )
        }
        url = `${ERROR_LOGGER_API_BASE}/errors/project/${projectId}`
        params = new URLSearchParams({ date })
        if (agentId) params.append('agentId', agentId)
        break

      case 'agent':
        if (!agentId || !date) {
          return NextResponse.json(
            { error: 'agentId and date are required for agent deletion' },
            { status: 400 }
          )
        }
        url = `${ERROR_LOGGER_API_BASE}/errors/agent/${agentId}`
        params = new URLSearchParams({ date })
        break

      case 'session':
        if (!sessionId) {
          return NextResponse.json(
            { error: 'sessionId is required for session deletion' },
            { status: 400 }
          )
        }
        url = `${ERROR_LOGGER_API_BASE}/errors/session/${sessionId}`
        break

      case 'cleanup':
        if (!projectId || !daysOld) {
          return NextResponse.json(
            { error: 'projectId and daysOld are required for cleanup' },
            { status: 400 }
          )
        }
        url = `${ERROR_LOGGER_API_BASE}/errors/cleanup`
        params = new URLSearchParams({
          projectId,
          daysOld: daysOld.toString()
        })
        if (agentId) params.append('agentId', agentId)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid deletion type' },
          { status: 400 }
        )
    }

    const fullUrl = params ? `${url}?${params.toString()}` : url
    const response = await fetch(fullUrl, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to delete errors: ${response.status} ${errorText}`)
      return NextResponse.json(
        { error: 'Failed to delete errors' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, message: 'Errors deleted successfully' })
  } catch (error: any) {
    console.error('Error in delete errors API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

