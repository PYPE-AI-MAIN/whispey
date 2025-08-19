import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
    const { data: project, error: projectError } = await supabase
      .from('pype_voice_projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    console.log(`Starting campaign creation for project: ${projectId}`)

    // Step 1: Update project with retry configuration
    const { error: projectUpdateError } = await supabase
      .from('pype_voice_projects')
      .update({ retry_configuration: retryConfig })
      .eq('id', projectId)

    if (projectUpdateError) {
      console.error('Error updating project retry config:', projectUpdateError)
      return NextResponse.json({ error: 'Failed to update project configuration' }, { status: 500 })
    }

    console.log('Updated project retry configuration')


    // Step 3: Upload CSV to S3
    const s3FormData = new FormData()
    s3FormData.append('file', csvFile)
    s3FormData.append('project_id', projectId)

    const s3Response = await fetch('https://3vakfucpd4.execute-api.ap-south-1.amazonaws.com/dev/api/v1/s3/upload', {
      method: 'POST',
      body: s3FormData,
    })

    if (!s3Response.ok) {
      console.error('Error uploading CSV to S3')
      return NextResponse.json({ error: 'Failed to upload CSV file' }, { status: 500 })
    }

    const s3Data = await s3Response.json()
    const s3Key = s3Data.s3Key || s3Data.key || s3Data.filePath
    console.log(`Uploaded CSV to S3: ${s3Key}`)

    // Step 4: Parse CSV data
    const csvText = await csvFile.text()
    const lines = csvText.split('\n').filter(line => line.trim())
    const headers = lines[0].split(',').map(h => h.trim())
    
    const callData = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = values[index] || ''
      })
      return obj
    })

    console.log(`Parsed ${callData.length} call records from CSV`)


    // Step 5: Create schedule
    const schedulePayload = {
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      concurrency: concurrency,
    }

    console.log(schedulePayload)


    const scheduleResponse = await fetch('https://3vakfucpd4.execute-api.ap-south-1.amazonaws.com/dev/api/v1/cron/create-schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(schedulePayload),
    })

    console.log(scheduleResponse)
    if (!scheduleResponse.ok) {
      console.error('Error creating schedule')
      return NextResponse.json({ error: 'Failed to create campaign schedule' }, { status: 500 })
    }

    const scheduleData = await scheduleResponse.json()
    console.log(`Created campaign schedule: ${scheduleData.scheduleId || 'success'}`)


    return NextResponse.json({}, { status: 201 })

  } catch (error) {
    console.error('Unexpected error creating campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 