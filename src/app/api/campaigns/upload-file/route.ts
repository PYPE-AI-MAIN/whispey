// app/api/campaigns/upload-file/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callScheduler, relay } from '@/lib/campaignScheduler'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId is required' },
        { status: 400 }
      )
    }

    // Get the CSV file from request body
    const csvData = await request.text()

    if (!csvData) {
      return NextResponse.json(
        { error: 'CSV data is required' },
        { status: 400 }
      )
    }

    // The scheduler may answer { accepted, rejected, rejects }; it is passed through for the import view.
    const out = await callScheduler('campaigns/upload-file', {
      method: 'POST',
      query: { campaignId },
      contentType: 'text/csv',
      body: csvData,
    })
    if ('error' in out) return out.error
    return relay(out.res, 'Failed to upload CSV')
  } catch (error) {
    console.error('Upload file error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
