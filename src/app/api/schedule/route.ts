import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Extract form data
    const { project_id, start_date, end_date, start_time, end_time, concurrency, retry_config } = body
    console.log(project_id, start_date, end_date, start_time, end_time, concurrency, retry_config)

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

    // Step 1: Update project retry configuration if provided
    if (retry_config && Object.keys(retry_config).length > 0) {
      console.log('Updating project retry configuration:', retry_config)

      const campaign_config = {endDate: end_date, startDate: start_date, dailyEndTime: end_time, dailyStartTime: start_time}
      
      
      const { error: projectUpdateError } = await supabase
        .from('pype_voice_projects')
        .update({ retry_configuration: retry_config, campaign_config:campaign_config })
        .eq('id', project_id)

      if (projectUpdateError) {
        console.error('Error updating project retry configuration:', projectUpdateError)
        return NextResponse.json({ error: 'Failed to update project retry configuration' }, { status: 500 })
      }
      
      console.log('Successfully updated project retry configuration')
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
    const scheduleResponse = await fetch('https://3vakfucpd4.execute-api.ap-south-1.amazonaws.com/dev/api/v1/cron/create-schedule', {
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
    console.log('Schedule created successfully:', scheduleData)

    return NextResponse.json({
      message: 'Campaign schedule created successfully',
      scheduleId: scheduleData.id,
      schedule: {
        start_date,
        end_date,
        start_time,
        end_time,
        concurrency: concurrencyNum
      },
      retry_configuration: retry_config
    })

  } catch (error) {
    console.error('Error in schedule route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
