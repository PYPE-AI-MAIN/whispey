import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Extract form data
    const { project_id, start_date, end_date, start_time, end_time, concurrency } = body
    console.log(project_id, start_date, end_date, start_time, end_time, concurrency)

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

    // Validate project ID for enhanced project only
    const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'
    if (project_id !== ENHANCED_PROJECT_ID) {
      return NextResponse.json({ error: 'Schedule creation not available for this project' }, { status: 403 })
    }

    // Validate concurrency
    const concurrencyNum = parseInt(concurrency) || 10
    if (concurrencyNum < 1 || concurrencyNum > 50) {
      return NextResponse.json({ error: 'Concurrency must be between 1 and 50' }, { status: 400 })
    }

    console.log(`Creating schedule for project: ${project_id}`)
    console.log(`Schedule: ${start_date} to ${end_date}, ${start_time}-${end_time}, concurrency: ${concurrencyNum}`)

    // Create schedule payload
    const schedulePayload = {
      start_date,
      end_date,
      start_time,
      end_time,
      concurrency: concurrencyNum
    }

    // Call external schedule API
    const scheduleResponse = await fetch('https://nbekv3zxpi.execute-api.ap-south-1.amazonaws.com/dev/api/v1/cron/create-schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(schedulePayload),
    })

    if (!scheduleResponse.ok) {
      const errorText = await scheduleResponse.text()
      console.error('Schedule creation failed:', errorText)
      return NextResponse.json({ error: 'Failed to create campaign schedule' }, { status: 500 })
    }

    const scheduleData = await scheduleResponse.json()
    const scheduleId = scheduleData.scheduleId || scheduleData.id || 'success'
    console.log(`Successfully created campaign schedule: ${scheduleId}`)

    return NextResponse.json({
      success: true,
      message: 'Campaign schedule created successfully',
      scheduleId: scheduleId,
      schedule: {
        start_date,
        end_date,
        start_time,
        end_time,
        concurrency: concurrencyNum
      },
      projectId: project_id
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error creating schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 