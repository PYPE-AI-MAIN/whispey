import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = 'pype-samunnati-dynamodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const lastEvaluatedKey = searchParams.get('lastKey') ? JSON.parse(searchParams.get('lastKey')!) : undefined
    const callStatus = searchParams.get('call_status')
    const sourceFile = searchParams.get('source_file')

    // Validate project ID for enhanced project only
    const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'
    if (projectId !== ENHANCED_PROJECT_ID) {
      return NextResponse.json(
        { error: 'Campaign logs not available for this project' },
        { status: 403 }
      )
    }

    // Build scan parameters
    const scanParams: any = {
      TableName: TABLE_NAME,
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    }

    // Add filters if provided
    const filterExpressions: string[] = []
    const expressionAttributeValues: any = {}
    const expressionAttributeNames: any = {}

    if (callStatus && callStatus !== 'all') {
      filterExpressions.push('#call_status = :call_status')
      expressionAttributeNames['#call_status'] = 'call_status'
      expressionAttributeValues[':call_status'] = callStatus
    }

    if (sourceFile) {
      filterExpressions.push('contains(sourceFile, :source_file)')
      expressionAttributeValues[':source_file'] = sourceFile
    }

    if (filterExpressions.length > 0) {
      scanParams.FilterExpression = filterExpressions.join(' AND ')
      scanParams.ExpressionAttributeValues = expressionAttributeValues
      scanParams.ExpressionAttributeNames = expressionAttributeNames
    }

    console.log(`Fetching campaign logs with params:`, scanParams)

    // Execute scan
    const command = new ScanCommand(scanParams)
    const result = await docClient.send(command)

    // Format response
    const response = {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Items?.length || 0,
      scannedCount: result.ScannedCount || 0
    }

    console.log(`Retrieved ${response.count} campaign logs`)

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Error fetching campaign logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign logs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, filters } = body

    // Validate project ID for enhanced project only
    const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'
    if (projectId !== ENHANCED_PROJECT_ID) {
      return NextResponse.json(
        { error: 'Campaign logs not available for this project' },
        { status: 403 }
      )
    }

    // Build more complex query with filters
    const scanParams: any = {
      TableName: TABLE_NAME,
      Limit: 100,
    }

    // Apply advanced filters
    if (filters && filters.length > 0) {
      const filterExpressions: string[] = []
      const expressionAttributeValues: any = {}
      const expressionAttributeNames: any = {}

      filters.forEach((filter: any, index: number) => {
        const { column, operation, value } = filter
        const attrName = `#attr${index}`
        const attrValue = `:val${index}`

        expressionAttributeNames[attrName] = column

        switch (operation) {
          case 'equals':
            filterExpressions.push(`${attrName} = ${attrValue}`)
            expressionAttributeValues[attrValue] = value
            break
          case 'contains':
            filterExpressions.push(`contains(${attrName}, ${attrValue})`)
            expressionAttributeValues[attrValue] = value
            break
          case 'greater_than':
            filterExpressions.push(`${attrName} > ${attrValue}`)
            expressionAttributeValues[attrValue] = parseFloat(value) || value
            break
          case 'less_than':
            filterExpressions.push(`${attrName} < ${attrValue}`)
            expressionAttributeValues[attrValue] = parseFloat(value) || value
            break
          case 'starts_with':
            filterExpressions.push(`begins_with(${attrName}, ${attrValue})`)
            expressionAttributeValues[attrValue] = value
            break
        }
      })

      if (filterExpressions.length > 0) {
        scanParams.FilterExpression = filterExpressions.join(' AND ')
        scanParams.ExpressionAttributeValues = expressionAttributeValues
        scanParams.ExpressionAttributeNames = expressionAttributeNames
      }
    }

    const command = new ScanCommand(scanParams)
    const result = await docClient.send(command)

    return NextResponse.json({
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Items?.length || 0,
    }, { status: 200 })

  } catch (error) {
    console.error('Error filtering campaign logs:', error)
    return NextResponse.json(
      { error: 'Failed to filter campaign logs' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const confirmToken = searchParams.get('confirm')

    // Validate project ID for enhanced project only
    const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'
    if (projectId !== ENHANCED_PROJECT_ID) {
      return NextResponse.json(
        { error: 'Campaign logs deletion not available for this project' },
        { status: 403 }
      )
    }

    // Require confirmation token
    if (confirmToken !== 'DELETE_ALL_CAMPAIGN_LOGS') {
      return NextResponse.json(
        { error: 'Missing or invalid confirmation token' },
        { status: 400 }
      )
    }

    console.log(`Starting bulk deletion of campaign logs for project: ${projectId}`)

    let deletedCount = 0
    let hasMore = true
    let lastEvaluatedKey = undefined

    // Delete in batches to avoid timeout and API limits
    while (hasMore) {
      const scanParams: any = {
        TableName: TABLE_NAME,
        Limit: 25, // Batch delete limit
        ExclusiveStartKey: lastEvaluatedKey,
        ProjectionExpression: 'id' // Only get the keys we need for deletion
      }

      const scanCommand = new ScanCommand(scanParams)
      const scanResult = await docClient.send(scanCommand)

      if (!scanResult.Items || scanResult.Items.length === 0) {
        break
      }

      // Create delete requests
      const deleteRequests = scanResult.Items.map(item => ({
        DeleteRequest: {
          Key: { id: item.id }
        }
      }))

      // Execute batch delete
      const batchCommand = new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: deleteRequests
        }
      })

      await docClient.send(batchCommand)
      deletedCount += deleteRequests.length

      console.log(`Deleted batch of ${deleteRequests.length} items. Total deleted: ${deletedCount}`)

      // Check if more items exist
      lastEvaluatedKey = scanResult.LastEvaluatedKey
      hasMore = !!lastEvaluatedKey

      // Small delay to prevent overwhelming DynamoDB
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`Bulk deletion completed. Total items deleted: ${deletedCount}`)

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} campaign log records`,
      deletedCount,
      projectId
    }, { status: 200 })

  } catch (error) {
    console.error('Error deleting campaign logs:', error)
    return NextResponse.json(
      { error: 'Failed to delete campaign logs' },
      { status: 500 }
    )
  }
}