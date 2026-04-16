// src/app/api/pipecat/agents/[agentId]/knowledge/url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

function getAgentId(url: string) {
  const segments = new URL(url).pathname.split('/')
  const urlIdx = segments.lastIndexOf('url')
  return urlIdx > 1 ? segments[urlIdx - 2] : null
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const base = process.env.PIPECAT_BASE_URL
  if (!base) return NextResponse.json({ error: 'PIPECAT_BASE_URL not set' }, { status: 500 })

  const agentId = getAgentId(request.url)
  if (!agentId) return NextResponse.json({ error: 'Agent ID required' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const { url } = body
  if (!url?.trim()) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  const res = await fetch(`${base}/v1/agents/${agentId}/knowledge/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'URL ingestion failed')
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data)
}