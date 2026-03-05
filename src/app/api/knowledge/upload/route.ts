import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy upload for RAG knowledge base.
 * Forwards file to backend; backend should store in vector DB and index by agent_id.
 * Backend contract: POST {base}/knowledge/upload with FormData (file, agent_id).
 */
export async function POST(request: NextRequest) {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL
    if (!apiBaseUrl) {
      return NextResponse.json(
        { error: 'Knowledge base API not configured' },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const agentId = formData.get('agent_id') as string | null
    if (!agentId?.trim()) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }

    const backendFormData = new FormData()
    backendFormData.append('agent_id', agentId.trim())
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      )
    }
    backendFormData.append('file', file)

    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
    const response = await fetch(`${apiBaseUrl}/knowledge/upload`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: backendFormData,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      if (response.status === 404 || response.status === 501) {
        return NextResponse.json(
          { error: 'Knowledge base upload not yet implemented on backend' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: errorText || 'Upload failed' },
        { status: response.status }
      )
    }

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (error) {
    console.error('Knowledge upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
