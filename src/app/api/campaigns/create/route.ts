// app/api/campaigns/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callScheduler } from '@/lib/campaignScheduler'
import { schedulerErrorMessage } from '@/utils/campaigns/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      campaignId,
      projectId,
      campaignName,
      s3FileKey,
      agentName,
      sipTrunkId,
      provider,
      agentRuntime,
      fromNumber,
      acefoneApiKey,
    } = body

    // Validation
    // if (!campaignId || !projectId || !campaignName || !s3FileKey || !agentName || !sipTrunkId || !provider) {
    //   return NextResponse.json(
    //     { error: 'Missing required fields' },
    //     { status: 400 }
    //   )
    // }

    const out = await callScheduler('campaigns/upload-v2', {
      method: 'POST',
      projectId,
      body: JSON.stringify({
        campaignId,
        projectId,
        campaignName,
        s3FileKey,
        agentName,
        sipTrunkId,
        provider,
        agentRuntime: agentRuntime || 'livekit',
        fromNumber: fromNumber || undefined,
        acefoneApiKey: acefoneApiKey || undefined,
      }),
    })
    if ('error' in out) return out.error
    const response = out.res

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: schedulerErrorMessage(data, 'Failed to create campaign'), ...(data.code && { code: data.code }) },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Create campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}