// Suggested dispositions for the MCP to offer when a caller isn't sure what to track.
import { NextRequest, NextResponse } from 'next/server'
import { DISPOSITION_SUGGESTIONS } from '@/lib/dispositions'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-agent-studio-secret')
  if (!secret || !process.env.AGENT_STUDIO_SECRET || secret !== process.env.AGENT_STUDIO_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ suggestions: DISPOSITION_SUGGESTIONS })
}
