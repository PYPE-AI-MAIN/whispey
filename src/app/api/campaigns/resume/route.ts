import { NextRequest, NextResponse } from 'next/server'
import { callScheduler } from '@/lib/campaignScheduler'
import { schedulerErrorMessage } from '@/utils/campaigns/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId is required' },
        { status: 400 }
      )
    }

    const out = await callScheduler(`campaigns/${campaignId}/resume`, { method: 'POST' })
    if ('error' in out) return out.error
    const response = out.res

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: schedulerErrorMessage(data, 'Failed to resume campaign'), ...(data.code && { code: data.code }) },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Resume campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

