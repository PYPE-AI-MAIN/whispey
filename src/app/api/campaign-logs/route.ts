// Campaign logs API - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

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

    // Read current data from JSON file
    const current = jsonFileService.readData() as any
    const agents = current.agents || []
    const agentIds = agents.filter((a: any) => a.project_id === project_id).map((a: any) => a.id)

    // Prefer stored campaign logs and normalize
    let campaignLogs = (current.campaignLogs || []).filter((log: any) => {
      return (log.project_id === project_id) || (log.agent_id && agentIds.includes(log.agent_id))
    }).map((c: any, idx: number) => ({
      id: (c.id && String(c.id).trim().length > 0) ? c.id : `camp_${c.agent_id || 'na'}_${c.phoneNumber || idx}`,
      ...c,
      project_id: c.project_id || (agents.find((a: any) => a.id === c.agent_id)?.project_id)
    }))

    // Synthesize from call logs if none exist
    if (campaignLogs.length === 0) {
      const base = (current.callLogs || []).filter((cl: any) => agentIds.includes(cl.agent_id))
      campaignLogs = base.map((cl: any, idx: number) => ({
        id: `camp_${cl.agent_id}_${idx}`,
        agent_id: cl.agent_id,
        project_id: agents.find((a: any) => a.id === cl.agent_id)?.project_id,
        phoneNumber: cl.customer_number,
        alternative_number: '',
        fpoName: 'Demo Org',
        fpoLoginId: `FPO-${cl.agent_id.slice(-3)}`,
        call_status: cl.call_ended_reason || 'completed',
        real_attempt_count: Math.max(1, Math.round(1 + Math.random() * 2)),
        system_error_count: Math.round(Math.random() * 1),
        sourceFile: 'demo.csv',
        createdAt: cl.created_at,
        uploadedAt: cl.created_at
      }))
    }
    
    // Apply filters
    if (call_status) {
      campaignLogs = campaignLogs.filter((log: any) => (log.call_status || log.call_ended_reason) === call_status)
    }
    
    if (search) {
      const searchLower = search.toLowerCase()
      campaignLogs = campaignLogs.filter((log: any) => {
        const phone = (log.phoneNumber || log.customer_number || '').toString().toLowerCase()
        const name = (log.fpoName || '').toString().toLowerCase()
        const login = (log.fpoLoginId || '').toString().toLowerCase()
        const callId = (log.call_id || '').toString().toLowerCase()
        return phone.includes(searchLower) || name.includes(searchLower) || login.includes(searchLower) || callId.includes(searchLower)
      })
    }

    // Apply sorting
    campaignLogs.sort((a: any, b: any) => {
      let aValue: any, bValue: any
      switch (sort_by) {
        case 'phoneNumber':
          aValue = a.phoneNumber || a.customer_number
          bValue = b.phoneNumber || b.customer_number
          break
        case 'call_status':
          aValue = a.call_status || a.call_ended_reason
          bValue = b.call_status || b.call_ended_reason
          break
        default:
          aValue = new Date(a.createdAt || a.created_at).getTime()
          bValue = new Date(b.createdAt || b.created_at).getTime()
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
    const formattedLogs = paginatedLogs.map((log: any) => ({
      id: log.id,
      phoneNumber: log.phoneNumber || log.customer_number,
      alternative_number: log.alternative_number || '',
      fpoName: log.fpoName || 'Demo Org',
      fpoLoginId: log.fpoLoginId || 'FPO-001',
      call_status: log.call_status || log.call_ended_reason || 'completed',
      real_attempt_count: log.real_attempt_count ?? 1,
      system_error_count: log.system_error_count ?? 0,
      createdAt: log.createdAt || log.created_at,
      uploadedAt: log.uploadedAt || log.created_at,
      sourceFile: log.sourceFile || 'demo.csv'
    }))

    const response = {
      items: formattedLogs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: endIndex < totalCount,
        hasPreviousPage: page > 1,
        nextPage: endIndex < totalCount ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null
      },
      filters: {},
      scannedCount: totalCount
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

    // Use file data
    const current = jsonFileService.readData() as any
    const agents = current.agents || []
    const agentIds = agents.filter((a: any) => a.project_id === projectId).map((a: any) => a.id)
    let campaignLogs = (current.campaignLogs || []).filter((log: any) => (log.project_id === projectId) || (log.agent_id && agentIds.includes(log.agent_id)))
    
    // Apply search
    if (search) {
      const searchLower = search.toLowerCase()
      campaignLogs = campaignLogs.filter((log: any) => {
        const phone = (log.phoneNumber || log.customer_number || '').toString().toLowerCase()
        const name = (log.fpoName || '').toString().toLowerCase()
        const login = (log.fpoLoginId || '').toString().toLowerCase()
        const callId = (log.call_id || '').toString().toLowerCase()
        return phone.includes(searchLower) || name.includes(searchLower) || login.includes(searchLower) || callId.includes(searchLower)
      })
    }

    // Apply filters
    filters.forEach((filter: any) => {
      if (filter.field && filter.value) {
        campaignLogs = campaignLogs.filter((log: any) => {
          const fieldValue = (log as any)[filter.field]
          return String(fieldValue ?? '').toLowerCase().includes(String(filter.value).toLowerCase())
        })
      }
    })

    // Apply pagination
    const totalCount = campaignLogs.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedLogs = campaignLogs.slice(startIndex, endIndex)

    // Format response
    const formattedLogs = paginatedLogs.map((log: any) => ({
      id: log.id,
      phoneNumber: log.phoneNumber || log.customer_number,
      alternative_number: log.alternative_number || '',
      fpoName: log.fpoName || 'Demo Org',
      fpoLoginId: log.fpoLoginId || 'FPO-001',
      call_status: log.call_status || log.call_ended_reason || 'completed',
      real_attempt_count: log.real_attempt_count ?? 1,
      system_error_count: log.system_error_count ?? 0,
      createdAt: log.createdAt || log.created_at,
      uploadedAt: log.uploadedAt || log.created_at,
      sourceFile: log.sourceFile || 'demo.csv'
    }))

    const response = {
      items: formattedLogs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: endIndex < totalCount,
        hasPreviousPage: page > 1,
        nextPage: endIndex < totalCount ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null
      },
      filters: {},
      scannedCount: totalCount
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Error processing campaign logs request:', error)
    return createErrorResponse('Failed to process campaign logs request')
  }
}