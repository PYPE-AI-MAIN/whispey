// src/app/api/pipecat/agents/[agentId]/knowledge/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPipecatBaseUrl } from '@/lib/utils'

function getAgentId(url: string) {
  const segments = new URL(url).pathname.split('/')
  // /api/pipecat/agents/[agentId]/knowledge
  const knowledgeIdx = segments.lastIndexOf('knowledge')
  return knowledgeIdx > 0 ? segments[knowledgeIdx - 1] : null
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const base = getPipecatBaseUrl()

  const agentId = getAgentId(request.url)
  if (!agentId) return NextResponse.json({ error: 'Agent ID required' }, { status: 400 })

  const res = await fetch(`${base}/v1/agents/${agentId}/knowledge`, {
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'error')
    return NextResponse.json({ error: err, documents: [] }, { status: res.status })
  }

  const data = await res.json().catch(() => ({ documents: [] }))
  return NextResponse.json(data)
}