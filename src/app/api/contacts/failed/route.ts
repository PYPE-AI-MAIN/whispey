// app/api/contacts/failed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

// Table name - adjust if different for production
const TABLE_NAME = process.env.DYNAMODB_CONTACTS_TABLE || 'contacts-prod'

function createDynamoDBClient() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AWS_REGION || 'ap-south-1'

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.')
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
    const limit = parseInt(searchParams.get('limit') || '100')
    const lastKey = searchParams.get('lastKey')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaign_id or campaignId parameter is required' },
        { status: 400 }
      )
    }

    // Create DynamoDB client (will throw if credentials are missing)
    let docClient
    try {
      docClient = createDynamoDBClient()
    } catch (credError: any) {
      console.error('AWS credentials error:', credError.message)
      return NextResponse.json(
        { 
          error: 'AWS credentials not configured',
          details: credError.message,
          hint: 'Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in your .env.local file'
        },
        { status: 500 }
      )
    }

    // Parse lastEvaluatedKey if provided
    let exclusiveStartKey: any = undefined
    if (lastKey) {
      try {
        exclusiveStartKey = JSON.parse(decodeURIComponent(lastKey))
      } catch (e) {
        console.warn('Failed to parse lastKey parameter')
      }
    }

    // Check if we should fetch all data (loop through pagination)
    // Default to true if no lastKey is provided (means start from beginning)
    const fetchAll = searchParams.get('fetch_all') !== 'false' && !lastKey

    // Build filter expression for status="failed" and campaign_id
    // Note: "status" is a reserved keyword in DynamoDB, so we must use ExpressionAttributeNames
    const filterExpression: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    // Filter by status - must use ExpressionAttributeNames since "status" is reserved
    filterExpression.push('#status = :status')
    expressionAttributeNames['#status'] = 'status'
    expressionAttributeValues[':status'] = 'failed'

    // Filter by campaign_id (try both camelCase and snake_case)
    filterExpression.push('(campaignId = :campaignId OR campaign_id = :campaignId)')
    expressionAttributeValues[':campaignId'] = campaignId

    let allItems: any[] = []
    let currentLastKey: any = exclusiveStartKey
    let totalScanned = 0
    let hasMore = true
    const maxScans = 1000 // Safety limit to prevent infinite loops
    let scanCount = 0

    // Loop through all pages automatically (unless fetch_all=false or lastKey is provided)
    do {
      scanCount++
      const scanParams = {
        TableName: TABLE_NAME,
        FilterExpression: filterExpression.join(' AND '),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ExclusiveStartKey: currentLastKey,
        Limit: 100, // DynamoDB max limit per scan
      }

      console.log(`Scanning batch ${scanCount}... (scanned so far: ${totalScanned})`)

      const command = new ScanCommand(scanParams)
      const result = await docClient.send(command)

      const items = result.Items || []
      allItems = allItems.concat(items)
      
      totalScanned += result.ScannedCount || 0
      currentLastKey = result.LastEvaluatedKey
      hasMore = !!currentLastKey

      console.log(`  ✓ Scanned ${result.ScannedCount || 0} items, found ${items.length} matching (Total found: ${allItems.length})`)

      // Safety break to prevent infinite loops
      if (scanCount >= maxScans) {
        console.warn(`  ⚠️  Reached scan limit (${maxScans}). Stopping pagination.`)
        break
      }

      // If fetch_all is explicitly false, only do one scan
      if (searchParams.get('fetch_all') === 'false') {
        break
      }
    } while (hasMore && fetchAll)

    console.log(`\n✅ Total failed contacts fetched: ${allItems.length} (scanned: ${totalScanned} items)`)

    // Prepare response
    const response: any = {
      contacts: allItems,
      total: allItems.length,
      totalScanned: totalScanned,
      hasMore: hasMore && !fetchAll, // Only show hasMore if we didn't fetch all
    }

    // Include pagination token if there are more items and we didn't fetch all
    if (hasMore && !fetchAll && currentLastKey) {
      response.nextKey = encodeURIComponent(JSON.stringify(currentLastKey))
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching failed contacts:', error)
    
    if (error.name === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: `Table "${TABLE_NAME}" not found` },
        { status: 404 }
      )
    }

    // Handle specific AWS errors
    if (error.name === 'UnrecognizedClientException') {
      return NextResponse.json(
        { 
          error: 'Invalid AWS credentials',
          details: 'The security token included in the request is invalid',
          hint: 'Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local'
        },
        { status: 401 }
      )
    }

    if (error.name === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: `Table "${TABLE_NAME}" not found` },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        errorType: error.name || 'UnknownError'
      },
      { status: 500 }
    )
  }
}

