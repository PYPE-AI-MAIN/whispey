// src/app/api/pipecat/agents/[agentId]/knowledge/[docId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

function getIds(url: string) {
  const segments = new URL(url).pathname.split('/')
  // .../agents/[agentId]/knowledge/[docId]
  const knowledgeIdx = segments.lastIndexOf('knowledge')
  if (knowledgeIdx < 0) return { agentId: null, docId: null }
  return {
    agentId: segments[knowledgeIdx - 1] ?? null,
    docId: segments[knowledgeIdx + 1] ?? null,
  }
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const base = process.env.PIPECAT_BASE_URL
  if (!base) return NextResponse.json({ error: 'PIPECAT_BASE_URL not set' }, { status: 500 })

  const { agentId, docId } = getIds(request.url)
  if (!agentId || !docId) return NextResponse.json({ error: 'Agent ID and doc ID required' }, { status: 400 })

  const res = await fetch(`${base}/v1/agents/${agentId}/knowledge/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Delete failed')
    return NextResponse.json({ error: err }, { status: res.status })
  }

  return NextResponse.json({ success: true })
}