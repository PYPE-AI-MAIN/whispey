// app/api/campaigns/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callScheduler } from '@/lib/campaignScheduler'
import { schedulerErrorMessage } from '@/utils/campaigns/constants'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const status = searchParams.get('status')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId is required' },
        { status: 400 }
      )
    }

    const out = await callScheduler(`campaigns/${encodeURIComponent(campaignId)}/contacts`, {
      query: {
        limit: searchParams.get('limit') || '50',
        lastKey: searchParams.get('lastKey'),
        cursor: searchParams.get('cursor'),
        status: status && status !== 'all' ? status : null,
      },
    })
    if ('error' in out) return out.error
    const { res } = out

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: schedulerErrorMessage(data, 'Failed to fetch contacts'), ...(data.code && { code: data.code }) },
        { status: res.status }
      )
    }

    // The scheduler may answer { items, nextCursor }; the UI reads { contacts, pagination }.
    if (data.items && !data.contacts) {
      return NextResponse.json({
        ...data,
        contacts: data.items,
        pagination: { hasMore: Boolean(data.nextCursor), nextKey: data.nextCursor ?? null },
      })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('List contacts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
