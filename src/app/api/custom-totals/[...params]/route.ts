// app/api/custom-totals/[...params]/route.ts
import { auth } from '@clerk/nextjs/server'
import { CustomTotalsService } from '@/services/customTotalService'
import { NextRequest } from 'next/server'

// GET /api/custom-totals/[projectId]/[agentId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  const { userId } = await auth()
  
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resolvedParams = await params
  const [projectId, agentId] = resolvedParams.params

  if (!projectId || !agentId) {
    return Response.json({ error: 'Missing projectId or agentId' }, { status: 400 })
  }

  try {
    const configs = await CustomTotalsService.getCustomTotals(projectId, agentId)
    return Response.json({ configs })
  } catch (error) {
    console.error('Custom totals GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/custom-totals/[projectId]/[agentId]
// POST /api/custom-totals/calculate/[projectId]/[agentId]
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  const { userId } = await auth()
  
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resolvedParams = await params
  const [action, projectId, agentId] = resolvedParams.params
  const body = await request.json()

  try {
    if (action === 'calculate') {
      // Handle calculation: POST /api/custom-totals/calculate/[projectId]/[agentId]
      if (!projectId || !agentId) {
        return Response.json({ error: 'Missing projectId or agentId' }, { status: 400 })
      }

      const { configIds, dateFrom, dateTo } = body

      if (!configIds || !Array.isArray(configIds)) {
        return Response.json({ error: 'Missing or invalid configIds' }, { status: 400 })
      }

      // Get configurations
      const allConfigs = await CustomTotalsService.getCustomTotals(projectId, agentId)
      const targetConfigs = allConfigs.filter(config => configIds.includes(config.id))

      // Calculate results
      const results = await Promise.all(
        targetConfigs.map(config => 
          CustomTotalsService.calculateCustomTotal(config, agentId, dateFrom, dateTo)
        )
      )

      return Response.json({ results })
    } else {
      // Handle creation: POST /api/custom-totals/[projectId]/[agentId]
      // In this case, action is actually projectId
      const actualProjectId = action
      const actualAgentId = projectId

      if (!actualProjectId || !actualAgentId) {
        return Response.json({ error: 'Missing projectId or agentId' }, { status: 400 })
      }

      const config = body
      if (!config.name || !config.aggregation || !config.column) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // Add metadata
      config.createdBy = userId
      config.createdAt = new Date().toISOString()
      config.updatedAt = new Date().toISOString()

      const result = await CustomTotalsService.saveCustomTotal(config, actualProjectId, actualAgentId)
      
      if (result.success) {
        return Response.json({ success: true }, { status: 201 })
      } else {
        return Response.json({ error: result.error }, { status: 400 })
      }
    }
  } catch (error) {
    console.error('Custom totals POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/custom-totals/[configId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  const { userId } = await auth()
  
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resolvedParams = await params
  const [configId] = resolvedParams.params

  if (!configId) {
    return Response.json({ error: 'Missing configId' }, { status: 400 })
  }

  try {
    const updates = await request.json()
    updates.updatedAt = new Date().toISOString()

    const result = await CustomTotalsService.updateCustomTotal(configId, updates)
    
    if (result.success) {
      return Response.json({ success: true })
    } else {
      return Response.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Custom totals PUT error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/custom-totals/[configId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  const { userId } = await auth()
  
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resolvedParams = await params
  const [configId] = resolvedParams.params

  if (!configId) {
    return Response.json({ error: 'Missing configId' }, { status: 400 })
  }

  try {
    const result = await CustomTotalsService.deleteCustomTotal(configId)
    
    if (result.success) {
      return Response.json({ success: true })
    } else {
      return Response.json({ error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('Custom totals DELETE error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}