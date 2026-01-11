// app/api/contacts/debug/route.ts
// Debug endpoint to inspect contact data structure
import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

const TABLE_NAME = process.env.DYNAMODB_CONTACTS_TABLE || 'contacts-prod'

function createDynamoDBClient() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AWS_REGION || 'ap-south-1'

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured')
  }

  const client = new DynamoDBClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return DynamoDBDocumentClient.from(client)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id') || searchParams.get('campaignId')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaign_id or campaignId parameter is required' },
        { status: 400 }
      )
    }

    const docClient = createDynamoDBClient()

    // First, scan with just campaign_id filter to see what we get
    const scanParams = {
      TableName: TABLE_NAME,
      FilterExpression: '(campaignId = :campaignId OR campaign_id = :campaignId)',
      ExpressionAttributeValues: {
        ':campaignId': campaignId,
      },
      Limit: limit,
    }

    const command = new ScanCommand(scanParams)
    const result = await docClient.send(command)

    const items = result.Items || []

    // Analyze the data structure
    const analysis: any = {
      totalScanned: result.ScannedCount || 0,
      itemsFound: items.length,
      sampleItem: items[0] || null,
      allFieldNames: new Set<string>(),
      statusValues: new Set<string>(),
      campaignIdFields: new Set<string>(),
    }

    items.forEach((item: any) => {
      Object.keys(item).forEach(key => analysis.allFieldNames.add(key))
      if (item.status) analysis.statusValues.add(item.status)
      if (item.Status) analysis.statusValues.add(item.Status)
      if (item.campaignId) analysis.campaignIdFields.add('campaignId')
      if (item.campaign_id) analysis.campaignIdFields.add('campaign_id')
    })

    return NextResponse.json({
      analysis: {
        ...analysis,
        allFieldNames: Array.from(analysis.allFieldNames).sort(),
        statusValues: Array.from(analysis.statusValues),
        campaignIdFields: Array.from(analysis.campaignIdFields),
      },
      sampleItems: items.slice(0, 3), // First 3 items as samples
    }, { status: 200 })
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

