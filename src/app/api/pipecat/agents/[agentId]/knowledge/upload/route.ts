// src/app/api/pipecat/agents/[agentId]/knowledge/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPipecatBaseUrl } from '@/lib/utils'

function getAgentId(url: string) {
  const segments = new URL(url).pathname.split('/')
  const uploadIdx = segments.lastIndexOf('upload')
  // .../agents/[agentId]/knowledge/upload
  return uploadIdx > 1 ? segments[uploadIdx - 2] : null
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const base = getPipecatBaseUrl()

  const agentId = getAgentId(request.url)
  if (!agentId) return NextResponse.json({ error: 'Agent ID required' }, { status: 400 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

  const backendForm = new FormData()
  backendForm.append('file', file)

  const res = await fetch(`${base}/v1/agents/${agentId}/knowledge/upload`, {
    method: 'POST',
    body: backendForm,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Upload failed')
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data)
}