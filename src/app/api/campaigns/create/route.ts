// app/api/campaigns/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user (middleware already protects this route)
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()

    const {
      campaignId,
      projectId,
      campaignName,
      s3FileKey,
      agentName,
      sipTrunkId,
      provider,
    } = body

    // Validation
    if (!campaignId || !projectId || !campaignName || !s3FileKey || !agentName || !sipTrunkId || !provider) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    const apiUrl = `${baseUrl}/api/v1/campaigns/upload-v2`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaignId,
        projectId,
        campaignName,
        s3FileKey,
        agentName,
        sipTrunkId,
        provider,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to create campaign' },
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