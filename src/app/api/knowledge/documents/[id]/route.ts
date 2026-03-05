import { NextRequest, NextResponse } from 'next/server'

/**
 * Delete a RAG knowledge base document.
 * Backend contract: DELETE {base}/knowledge/documents/:id
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'Document id is required' },
        { status: 400 }
      )
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL
    if (!apiBaseUrl) {
      return NextResponse.json(
        { error: 'Knowledge base API not configured' },
        { status: 503 }
      )
    }

    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
    const response = await fetch(
      `${apiBaseUrl}/knowledge/documents/${encodeURIComponent(id.trim())}`,
      {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey },
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      if (response.status === 404 || response.status === 501) {
        return NextResponse.json(
          { error: 'Knowledge base delete not yet implemented on backend' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: errorText || 'Delete failed' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Knowledge document delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
