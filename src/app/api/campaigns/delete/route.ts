import { NextRequest, NextResponse } from 'next/server'
import { callScheduler } from '@/lib/campaignScheduler'
import { schedulerErrorMessage } from '@/utils/campaigns/constants'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId is required' },
        { status: 400 }
      )
    }

    const out = await callScheduler(`campaigns/${campaignId}`, { method: 'DELETE' })
    if ('error' in out) return out.error
    const response = out.res

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: schedulerErrorMessage(data, 'Failed to delete campaign'), ...(data.code && { code: data.code }) },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Delete campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

