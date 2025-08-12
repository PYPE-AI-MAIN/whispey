// Campaign API - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    // Extract form data
    const projectId = formData.get('project_id') as string
    const startDate = formData.get('start_date') as string
    const endDate = formData.get('end_date') as string
    const startTime = formData.get('start_time') as string
    const endTime = formData.get('end_time') as string
    const concurrency = parseInt(formData.get('concurrency') as string) || 10
    const retryConfig = JSON.parse(formData.get('retry_config') as string || '{}')
    const csvFile = formData.get('csv_file') as File

    // Validation
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }
    
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }
    
    if (!csvFile) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
    }

    // Validate retry configuration
    if (retryConfig) {
      const validCodes = ['408', '480', '486', '504', '600']
      for (const [code, minutes] of Object.entries(retryConfig)) {
        if (!validCodes.includes(code)) {
          return NextResponse.json({ error: `Invalid SIP code: ${code}` }, { status: 400 })
        }
        if (typeof minutes !== 'number' || minutes < 1 || minutes > 1440) {
          return NextResponse.json({ error: `Invalid retry minutes for ${code}: must be between 1 and 1440` }, { status: 400 })
        }
      }
    }

    // Verify project exists
    const project = jsonFileService.getProjectById(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Mock: Process CSV file
    const csvText = await csvFile.text()
    const csvLines = csvText.split('\n').filter(line => line.trim())
    const phoneNumbers = csvLines.slice(1) // Skip header
      .map(line => line.split(',')[0]) // Assume phone number is first column
      .filter(phone => phone && phone.trim())

    if (phoneNumbers.length === 0) {
      return NextResponse.json({ error: 'No valid phone numbers found in CSV' }, { status: 400 })
    }

    // Mock: Update project with campaign config
    const campaignConfig = {
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      concurrency,
      retry_config: retryConfig,
      phone_numbers: phoneNumbers,
      total_numbers: phoneNumbers.length,
      created_at: new Date().toISOString()
    }

    const updatedProject = jsonFileService.updateProject(projectId, {
      campaign_config: campaignConfig
    })

    if (!updatedProject) {
      return NextResponse.json({ error: 'Failed to save campaign configuration' }, { status: 500 })
    }

    console.log(`Mock: Campaign created successfully for project ${projectId} with ${phoneNumbers.length} phone numbers`)

    return NextResponse.json({
      success: true,
      message: 'Campaign created successfully',
      campaign: {
        id: `campaign_${Date.now()}`,
        project_id: projectId,
        total_numbers: phoneNumbers.length,
        config: campaignConfig
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create campaign',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}