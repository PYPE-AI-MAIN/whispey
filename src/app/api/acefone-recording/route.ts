// Resolves the Acefone console recording link for a call. The console URL
// needs a per-recording encrypted token that only Acefone's CDR API returns —
// it cannot be templated from the agent's acefone_token JWT. The JWT itself
// is resolved server-side from the agent's Transfer Call tool config, so it
// never reaches the browser.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { mintServiceToken } from '@/lib/serviceToken'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getPypeApiBaseUrlForServer, pypeApiAbortSignal } from '@/lib/pypeApiFetch'

const supabase = createServiceRoleClient()

async function getAgentAcefoneToken(agentId: string): Promise<string | null> {
  const { data: agent } = await supabase
    .from('pype_voice_agents')
    .select('name')
    .eq('id', agentId)
    .maybeSingle()
  if (!agent?.name) return null

  const baseUrl = getPypeApiBaseUrlForServer()
  if (!baseUrl) return null

  const agentName = `${agent.name}_${agentId.replaceAll('-', '_')}`
  const res = await fetch(`${baseUrl}/agent_config/${encodeURIComponent(agentName)}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'pype-api-v1',
      Authorization: 'Bearer ' + mintServiceToken(),
    },
    signal: pypeApiAbortSignal(),
  })
  if (!res.ok) return null

  const config = await res.json().catch(() => null)
  const transferTool = config?.agent?.assistant?.[0]?.tools?.find(
    (t: any) => t.type === 'transfer_call'
  )
  return transferTool?.acefone_token || null
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { callId, agentId } = await req.json().catch(() => ({}))
  if (!callId || !agentId) {
    return NextResponse.json({ error: 'callId and agentId are required' }, { status: 400 })
  }

  const token = await getAgentAcefoneToken(agentId)
  if (!token) {
    return NextResponse.json({ error: 'No acefone token configured for this agent' }, { status: 404 })
  }

  const res = await fetch(
    `https://api.acefone.in/v1/call/records?call_id=${encodeURIComponent(callId)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  )
  if (!res.ok) {
    return NextResponse.json({ error: `Acefone API error: ${res.status}` }, { status: 502 })
  }

  const data = await res.json()
  const recordingUrl = data?.results?.[0]?.recording_url || null
  return NextResponse.json({ recordingUrl })
}
