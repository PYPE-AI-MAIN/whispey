// Campaign logs API - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { MockDataService } from '@/lib/mockData'

// Helper functions
function parseIntWithDefault(value: string | null, defaultValue: number, min?: number, max?: number): number {
  const parsed = parseInt(value || '', 10)
  if (isNaN(parsed)) return defaultValue
  if (min !== undefined && parsed < min) return min
  if (max !== undefined && parsed > max) return max
  return parsed
}

function cleanString(value: string | null): string | null {
  return value?.trim() || null
}

function createErrorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status })
}

function validateProjectAccess(projectId: string): boolean {
  // Mock: always allow access for demo
  return true
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

    if (!project_id) {
      return createErrorResponse('Missing project_id parameter', 400)
    }

    // Validate project access
    if (!validateProjectAccess(project_id)) {
      return createErrorResponse('Campaign logs not available for this project', 403)
    }

    // Get mock campaign logs (using call logs as sample data)
    let campaignLogs = MockDataService.getCallLogs()
    
    // Apply filters
    if (call_status) {
      campaignLogs = campaignLogs.filter(log => log.call_ended_reason === call_status)
    }
    
    if (search) {
      const searchLower = search.toLowerCase()
      campaignLogs = campaignLogs.filter(log => 
        log.customer_number.toLowerCase().includes(searchLower) ||
        log.call_id.toLowerCase().includes(searchLower)
      )
    }

    // Apply sorting
    campaignLogs.sort((a, b) => {
      let aValue, bValue
      switch (sort_by) {
        case 'phoneNumber':
          aValue = a.customer_number
          bValue = b.customer_number
          break
        case 'call_status':
          aValue = a.call_ended_reason
          bValue = b.call_ended_reason
          break
        default:
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
      }

      if (sort_order === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    // Apply pagination
    const totalCount = campaignLogs.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedLogs = campaignLogs.slice(startIndex, endIndex)

    // Format response to match expected structure
    const formattedLogs = paginatedLogs.map(log => ({
      id: log.id,
      phoneNumber: log.customer_number,
      call_status: log.call_ended_reason,
      createdAt: log.created_at,
      duration: log.duration_seconds,
      cost: log.total_stt_cost + log.total_tts_cost + log.total_llm_cost
    }))

    const response = {
      success: true,
      data: {
        items: formattedLogs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: endIndex < totalCount,
          hasPrevious: page > 1
        },
        summary: {
          totalCalls: totalCount,
          completedCalls: campaignLogs.filter(log => log.call_ended_reason === 'completed').length,
          totalCost: campaignLogs.reduce((sum, log) => 
            sum + log.total_stt_cost + log.total_tts_cost + log.total_llm_cost, 0
          )
        }
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
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

    if (!projectId) {
      return createErrorResponse('Missing projectId in request body', 400)
    }

    // Validate project access
    if (!validateProjectAccess(projectId)) {
      return createErrorResponse('Campaign logs not available for this project', 403)
    }

    // Use same logic as GET but with POST body filters
    let campaignLogs = MockDataService.getCallLogs()
    
    // Apply search
    if (search) {
      const searchLower = search.toLowerCase()
      campaignLogs = campaignLogs.filter(log => 
        log.customer_number.toLowerCase().includes(searchLower) ||
        log.call_id.toLowerCase().includes(searchLower)
      )
    }

    // Apply filters
    filters.forEach((filter: any) => {
      if (filter.field && filter.value) {
        campaignLogs = campaignLogs.filter(log => {
          const fieldValue = (log as any)[filter.field]
          return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase())
        })
      }
    })

    // Apply pagination
    const totalCount = campaignLogs.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedLogs = campaignLogs.slice(startIndex, endIndex)

    // Format response
    const formattedLogs = paginatedLogs.map(log => ({
      id: log.id,
      phoneNumber: log.customer_number,
      call_status: log.call_ended_reason,
      createdAt: log.created_at,
      duration: log.duration_seconds,
      cost: log.total_stt_cost + log.total_tts_cost + log.total_llm_cost
    }))

    const response = {
      success: true,
      data: {
        items: formattedLogs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: endIndex < totalCount,
          hasPrevious: page > 1
        }
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Error processing campaign logs request:', error)
    return createErrorResponse('Failed to process campaign logs request')
  }
}