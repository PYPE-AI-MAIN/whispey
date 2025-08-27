import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = 'pype-samunnati-dynamodb-2'
const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'

// Helper functions
function validateProjectAccess(projectId: string): boolean {
  return projectId === ENHANCED_PROJECT_ID
}

function parseIntWithDefault(value: string | null, defaultValue: number, min?: number, max?: number): number {
  const parsed = parseInt(value || '') || defaultValue
  if (min !== undefined && parsed < min) return min
  if (max !== undefined && parsed > max) return max
  return parsed
}

function cleanString(value: string | null): string | undefined {
  const cleaned = value?.trim()
  return cleaned && cleaned !== 'all' && cleaned !== '' ? cleaned : undefined
}

function buildFilterExpression(params: {
  callStatus?: string
  sourceFile?: string
  search?: string
  filters?: Array<{ column: string; operation: string; value: string | number }>
}) {
  const filterExpressions: string[] = []
  const expressionAttributeValues: Record<string, any> = {}
  const expressionAttributeNames: Record<string, string> = {}

  // Call status filter
  if (params.callStatus) {
    filterExpressions.push('#call_status = :call_status')
    expressionAttributeNames['#call_status'] = 'call_status'
    expressionAttributeValues[':call_status'] = params.callStatus
  }

  // Source file filter
  if (params.sourceFile) {
    filterExpressions.push('contains(#sourceFile, :source_file)')
    expressionAttributeNames['#sourceFile'] = 'sourceFile'
    expressionAttributeValues[':source_file'] = params.sourceFile
  }

  // Global search across multiple fields
  if (params.search) {
    const searchTerm = params.search.toLowerCase()
    const searchExpressions = [
      'contains(#phoneNumber, :search)',
      'contains(#fpoName, :search)',
      'contains(#fpoLoginId, :search)',
      'contains(#sourceFile_search, :search)'
    ]
    
    filterExpressions.push(`(${searchExpressions.join(' OR ')})`)
    expressionAttributeNames['#phoneNumber'] = 'phoneNumber'
    expressionAttributeNames['#fpoName'] = 'fpoName'
    expressionAttributeNames['#fpoLoginId'] = 'fpoLoginId'
    expressionAttributeNames['#sourceFile_search'] = 'sourceFile'
    expressionAttributeValues[':search'] = searchTerm
  }

  // Advanced filters from POST request
  if (params.filters?.length) {
    params.filters.forEach((filter, index) => {
      const attrName = `#attr${index}`
      const attrValue = `:val${index}`

      expressionAttributeNames[attrName] = filter.column

      switch (filter.operation) {
        case 'equals':
          filterExpressions.push(`${attrName} = ${attrValue}`)
          expressionAttributeValues[attrValue] = filter.value
          break
        case 'contains':
          filterExpressions.push(`contains(${attrName}, ${attrValue})`)
          expressionAttributeValues[attrValue] = filter.value
          break
        case 'greater_than':
          filterExpressions.push(`${attrName} > ${attrValue}`)
          expressionAttributeValues[attrValue] = typeof filter.value === 'string' 
            ? parseFloat(filter.value) || filter.value 
            : filter.value
          break
        case 'less_than':
          filterExpressions.push(`${attrName} < ${attrValue}`)
          expressionAttributeValues[attrValue] = typeof filter.value === 'string' 
            ? parseFloat(filter.value) || filter.value 
            : filter.value
          break
        case 'starts_with':
          filterExpressions.push(`begins_with(${attrName}, ${attrValue})`)
          expressionAttributeValues[attrValue] = filter.value
          break
      }
    })
  }

  return {
    FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(' AND ') : undefined,
    ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
    ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
  }
}

function createErrorResponse(message: string, status: number = 500) {
  console.error(`API Error (${status}): ${message}`)
  return NextResponse.json({ error: message }, { status })
}

function createSuccessResponse(data: any, message?: string) {
  return NextResponse.json({ 
    ...data,
    ...(message && { message })
  }, { status: 200 })
}

// Get total count efficiently (separate from main query)
async function getTotalCount(filterConfig: any): Promise<number> {
  try {
    let totalCount = 0
    let hasMore = true
    let lastEvaluatedKey = undefined
    
    const countParams = {
      TableName: TABLE_NAME,
      Select: 'COUNT' as const,
      ...filterConfig,
    }
    
    // Use multiple scans to get accurate count with filters
    while (hasMore && totalCount < 10000) { // Cap at 10k for performance
      const scanParams:any= {
        ...countParams,
        ExclusiveStartKey: lastEvaluatedKey,
      }
      
      const command = new ScanCommand(scanParams)
      const result = await docClient.send(command)
      
      totalCount += result.Count || 0
      lastEvaluatedKey = result.LastEvaluatedKey
      hasMore = !!lastEvaluatedKey
      
      // Break after reasonable number of scans
      if (totalCount > 5000) break
    }
    
    return totalCount
  } catch (error) {
    console.error('Error getting total count:', error)
    return 0
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Extract and parse parameters with defaults
    const project_id = searchParams.get('project_id')
    const page = parseIntWithDefault(searchParams.get('page'), 1, 1)
    const limit = parseIntWithDefault(searchParams.get('limit'), 20, 1, 100)
    const call_status = cleanString(searchParams.get('call_status'))
    const source_file = cleanString(searchParams.get('source_file'))
    const search = cleanString(searchParams.get('search'))
    const sort_by = ['createdAt', 'phoneNumber', 'call_status'].includes(searchParams.get('sort_by') || '') 
      ? searchParams.get('sort_by')! : 'createdAt'
    const sort_order = searchParams.get('sort_order') === 'asc' ? 'asc' : 'desc'
    
    // Handle pagination tokens for DynamoDB
    const lastKeyParam = searchParams.get('lastKey')
    let lastEvaluatedKey = undefined
    
    if (lastKeyParam) {
      try {
        lastEvaluatedKey = JSON.parse(decodeURIComponent(lastKeyParam))
      } catch (e) {
        console.warn('Failed to parse lastKey parameter')
      }
    }

    console.log('Parsed parameters:', { project_id, page, limit, call_status, source_file, search, sort_by, sort_order })

    if (!project_id) {
      return createErrorResponse('Missing project_id parameter', 400)
    }

    // Validate project access
    if (!validateProjectAccess(project_id)) {
      return createErrorResponse('Campaign logs not available for this project', 403)
    }

    // Build filter expressions
    const filterConfig = buildFilterExpression({
      callStatus: call_status,
      sourceFile: source_file,
      search: search,
    })

    console.log('Filter config:', filterConfig)

    // For true pagination, we need to collect enough items to fill the requested page
    // Since DynamoDB doesn't support offset-based pagination directly, we simulate it
    const itemsNeeded = page * limit
    let allItems: any[] = []
    let hasMore = true
    let currentLastKey = lastEvaluatedKey
    let scannedCount = 0

    // Collect items until we have enough for the requested page
    while (hasMore && allItems.length < itemsNeeded + limit) {
      const scanParams: any = {
        TableName: TABLE_NAME,
        Limit: Math.min(100, itemsNeeded + limit - allItems.length), // Fetch in reasonable chunks
        ExclusiveStartKey: currentLastKey,
        ...filterConfig,
      }

      const command = new ScanCommand(scanParams)
      const result = await docClient.send(command)

      const items = result.Items || []
      allItems = allItems.concat(items)
      scannedCount += result.ScannedCount || 0
      
      currentLastKey = result.LastEvaluatedKey
      hasMore = !!currentLastKey
      
      // Safety break to avoid infinite loops
      if (scannedCount > 5000) break
    }

    console.log(`Collected ${allItems.length} items from DynamoDB`)

    // Sort items in memory (since DynamoDB scan doesn't support sorting)
    if (allItems.length > 0) {
      allItems.sort((a, b) => {
        let aValue = a[sort_by]
        let bValue = b[sort_by]
        
        // Handle different data types
        if (sort_by === 'createdAt') {
          aValue = new Date(aValue).getTime()
          bValue = new Date(bValue).getTime()
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase()
          bValue = bValue.toLowerCase()
        }
        
        if (sort_order === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
        }
      })
    }

    // Calculate pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedItems = allItems.slice(startIndex, endIndex)
    
    // Get total count (this is expensive, but necessary for pagination)
    const totalItems = allItems.length < itemsNeeded + limit ? allItems.length : await getTotalCount(filterConfig)
    const totalPages = Math.ceil(totalItems / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // Format response with pagination metadata
    const response = {
      items: paginatedItems,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage,
        hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : null,
        previousPage: hasPreviousPage ? page - 1 : null,
      },
      filters: {
        call_status,
        source_file,
        search,
        sort_by,
        sort_order,
      },
      scannedCount,
      // Include last evaluated key for potential optimization
      lastEvaluatedKey: currentLastKey,
    }

    console.log(`Retrieved ${paginatedItems.length}/${totalItems} campaign logs (Page ${page}/${totalPages})`)

    return createSuccessResponse(response)

  } catch (error: any) {
    console.error('Error fetching campaign logs:', error)
    return createErrorResponse('Failed to fetch campaign logs')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Extract and validate parameters
    const projectId = body.projectId
    const page = parseIntWithDefault(body.page?.toString(), 1, 1)
    const limit = parseIntWithDefault(body.limit?.toString(), 20, 1, 100)
    const filters = Array.isArray(body.filters) ? body.filters : []
    const search = cleanString(body.search)
    const sort_by = ['createdAt', 'phoneNumber', 'call_status'].includes(body.sort_by) ? body.sort_by : 'createdAt'
    const sort_order = body.sort_order === 'asc' ? 'asc' : 'desc'

    if (!projectId) {
      return createErrorResponse('Missing projectId in request body', 400)
    }

    // Validate project access
    if (!validateProjectAccess(projectId)) {
      return createErrorResponse('Campaign logs not available for this project', 403)
    }

    // Build filter expressions
    const filterConfig = buildFilterExpression({
      filters,
      search,
    })

    console.log(`Advanced filtering campaign logs - Page: ${page}, Limit: ${limit}, Filters:`, filters)

    // Similar pagination logic as GET
    const itemsNeeded = page * limit
    let allItems: any[] = []
    let hasMore = true
    let lastEvaluatedKey = undefined
    let scannedCount = 0

    while (hasMore && allItems.length < itemsNeeded + limit) {
      const scanParams: any = {
        TableName: TABLE_NAME,
        Limit: Math.min(100, itemsNeeded + limit - allItems.length),
        ExclusiveStartKey: lastEvaluatedKey,
        ...filterConfig,
      }

      const command = new ScanCommand(scanParams)
      const result = await docClient.send(command)

      const items = result.Items || []
      allItems = allItems.concat(items)
      scannedCount += result.ScannedCount || 0
      
      lastEvaluatedKey = result.LastEvaluatedKey
      hasMore = !!lastEvaluatedKey
      
      if (scannedCount > 5000) break
    }

    // Sort items
    if (allItems.length > 0) {
      allItems.sort((a, b) => {
        let aValue = a[sort_by]
        let bValue = b[sort_by]
        
        if (sort_by === 'createdAt') {
          aValue = new Date(aValue).getTime()
          bValue = new Date(bValue).getTime()
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase()
          bValue = bValue.toLowerCase()
        }
        
        if (sort_order === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
        }
      })
    }

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedItems = allItems.slice(startIndex, endIndex)
    
    const totalItems = allItems.length < itemsNeeded + limit ? allItems.length : await getTotalCount(filterConfig)
    const totalPages = Math.ceil(totalItems / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    const response = {
      items: paginatedItems,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage,
        hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : null,
        previousPage: hasPreviousPage ? page - 1 : null,
      },
      filters: {
        advanced: filters,
        search,
        sort_by,
        sort_order,
      },
      scannedCount,
    }

    console.log(`Advanced filter returned ${paginatedItems.length}/${totalItems} logs (Page ${page}/${totalPages})`)

    return createSuccessResponse(response)

  } catch (error: any) {
    console.error('Error filtering campaign logs:', error)
    return createErrorResponse('Failed to filter campaign logs')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const confirmToken = searchParams.get('confirm')

    // Validate inputs
    if (!projectId) {
      return createErrorResponse('Missing project_id parameter', 400)
    }

    if (!validateProjectAccess(projectId)) {
      return createErrorResponse('Campaign logs deletion not available for this project', 403)
    }

    if (confirmToken !== 'DELETE_ALL_CAMPAIGN_LOGS') {
      return createErrorResponse('Missing or invalid confirmation token', 400)
    }

    console.log(`Starting bulk deletion of campaign logs for project: ${projectId}`)

    let deletedCount = 0
    let batchCount = 0
    let hasMore = true
    let lastEvaluatedKey = undefined

    // Delete in batches to avoid timeout and API limits
    while (hasMore) {
      batchCount++
      
      const scanParams: any = {
        TableName: TABLE_NAME,
        Limit: 25, // Batch delete limit
        ExclusiveStartKey: lastEvaluatedKey,
        ProjectionExpression: 'id', // Only get the keys we need for deletion
      }

      const scanCommand = new ScanCommand(scanParams)
      const scanResult = await docClient.send(scanCommand)

      if (!scanResult.Items || scanResult.Items.length === 0) {
        console.log(`No more items to delete after ${batchCount} batches`)
        break
      }

      // Create delete requests
      const deleteRequests = scanResult.Items.map(item => ({
        DeleteRequest: {
          Key: { id: item.id }
        }
      }))

      try {
        // Execute batch delete
        const batchCommand = new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: deleteRequests
          }
        })

        await docClient.send(batchCommand)
        deletedCount += deleteRequests.length

        console.log(`Batch ${batchCount}: Deleted ${deleteRequests.length} items. Total deleted: ${deletedCount}`)
      } catch (batchError) {
        console.error(`Error in batch ${batchCount}:`, batchError)
        // Continue with next batch even if one fails
      }

      // Check if more items exist
      lastEvaluatedKey = scanResult.LastEvaluatedKey
      hasMore = !!lastEvaluatedKey

      // Rate limiting: small delay to prevent overwhelming DynamoDB
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Safety check: prevent infinite loops
      if (batchCount >= 1000) {
        console.warn(`Stopping deletion after ${batchCount} batches for safety`)
        break
      }
    }

    const successMessage = `Successfully deleted ${deletedCount} campaign log records in ${batchCount} batches`
    console.log(`Bulk deletion completed: ${successMessage}`)

    return createSuccessResponse({
      success: true,
      message: successMessage,
      deletedCount,
      batchCount,
      projectId
    })

  } catch (error: any) {
    console.error('Error deleting campaign logs:', error)
    return createErrorResponse('Failed to delete campaign logs')
  }
}