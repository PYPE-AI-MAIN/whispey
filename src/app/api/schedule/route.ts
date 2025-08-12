// Schedule API - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { MockDataService } from '@/lib/mockData'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Extract form data
    const { project_id, start_date, end_date, start_time, end_time, concurrency, retry_config } = body

    // Validation
    if (!project_id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }
    
    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    if (!start_time || !end_time) {
      return NextResponse.json({ error: 'Start time and end time are required' }, { status: 400 })
    }

    // Validate concurrency
    const concurrencyNum = parseInt(concurrency) || 10
    if (concurrencyNum < 1 || concurrencyNum > 50) {
      return NextResponse.json({ error: 'Concurrency must be between 1 and 50' }, { status: 400 })
    }

    // Validate retry configuration
    if (retry_config) {
      const validCodes = ['408', '480', '486', '504', '600']
      for (const [code, minutes] of Object.entries(retry_config)) {
        if (!validCodes.includes(code)) {
          return NextResponse.json({ error: `Invalid SIP code: ${code}` }, { status: 400 })
        }
        if (typeof minutes !== 'number' || minutes < 1 || minutes > 1440) {
          return NextResponse.json({ error: `Invalid retry minutes for ${code}: must be between 1 and 1440` }, { status: 400 })
        }
      }
    }

    // Check if project exists
    const project = MockDataService.getProjectById(project_id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Mock: simulate updating project retry configuration
    if (retry_config) {
      const updatedProject = MockDataService.updateProject(project_id, {
        retry_configuration: retry_config
      })
      
      if (!updatedProject) {
        return NextResponse.json({ error: 'Failed to update project configuration' }, { status: 500 })
      }
    }

    // Mock: simulate scheduling campaign
    const mockSchedule = {
      id: `schedule_${Date.now()}`,
      project_id,
      start_date,
      end_date,
      start_time,
      end_time,
      concurrency: concurrencyNum,
      retry_config: retry_config || {},
      status: 'scheduled',
      created_at: new Date().toISOString()
    }

    console.log('Mock: Campaign scheduled successfully:', mockSchedule)

    return NextResponse.json({
      success: true,
      message: 'Campaign scheduled successfully',
      schedule: mockSchedule
    }, { status: 200 })

  } catch (error) {
    console.error('Error scheduling campaign:', error)
    return NextResponse.json(
      { 
        error: 'Failed to schedule campaign',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}