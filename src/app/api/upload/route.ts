import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    // Extract form data
    const projectId = formData.get('project_id') as string
    const csvFile = formData.get('file') as File

    // Validation
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }
    
    if (!csvFile) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
    }

    // Validate project ID for enhanced project only
    const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'
    if (projectId !== ENHANCED_PROJECT_ID) {
      return NextResponse.json({ error: 'CSV upload not available for this project' }, { status: 403 })
    }

    console.log(`Starting CSV upload for project: ${projectId}`)
    console.log(`File: ${csvFile.name} (${csvFile.size} bytes)`)

    // Upload CSV to S3
    const s3FormData = new FormData()
    s3FormData.append('file', csvFile)
    s3FormData.append('project_id', projectId)

    const s3Response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL_OLD_CAMPAIGN}/api/v1/s3/upload`, {
      method: 'POST',
      body: s3FormData,
    })

    if (!s3Response.ok) {
      const errorText = await s3Response.text()
      console.error('S3 upload failed:', errorText)
      return NextResponse.json({ error: 'Failed to upload CSV file to S3' }, { status: 500 })
    }

    const s3Data = await s3Response.json()
    console.log('S3 API Response:', JSON.stringify(s3Data, null, 2))
    
    // Try multiple possible key names from S3 response
    const s3Key = s3Data.s3Key || 
                  s3Data.key || 
                  s3Data.filePath || 
                  s3Data.s3_key ||
                  s3Data.file_path ||
                  s3Data.fileName ||
                  s3Data.objectKey ||
                  s3Data.Key ||
                  'upload_successful_but_key_unavailable'
                  
    console.log(`Extracted S3 Key: ${s3Key}`)
    console.log(`Successfully uploaded CSV to S3: ${s3Key}`)

    return NextResponse.json({
      success: true,
      message: 'CSV uploaded successfully',
      s3Key: s3Key,
      fileName: csvFile.name,
      fileSize: csvFile.size,
      projectId: projectId,
      uploadUrl: s3Data.url || s3Data.fileUrl || null
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error uploading CSV:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 