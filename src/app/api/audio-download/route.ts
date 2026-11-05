import { NextRequest, NextResponse } from 'next/server'
import AWS from 'aws-sdk'
import { withDataPlane, rethrowDataPlane } from '@/server/data-plane'
import { signRoutedRecording } from '@/server/audio/routed'

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
})

export const GET = withDataPlane(async (dp, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const s3Key = searchParams.get('s3Key')
    const filename = searchParams.get('filename') || 'audio.mp3'

    if (!s3Key) {
      return NextResponse.json({ error: 'S3 key required' }, { status: 400 })
    }

    // A customer-held project's recording is fetched through the customer's signer.
    const routed = await signRoutedRecording(dp, searchParams.get('agentId'), s3Key)
    if (routed instanceof NextResponse) return routed
    if (routed) {
      const upstream = await fetch(routed.url, { signal: AbortSignal.timeout(30000) })
      if (!upstream.ok) return NextResponse.json({ error: 'Audio file not found' }, { status: upstream.status === 404 ? 404 : 502 })
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'audio/ogg',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache',
        },
      })
    }

    // Get the audio file directly from S3
    const s3Response = await s3.getObject({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
    }).promise()

    if (!s3Response.Body) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }

    // Convert the S3 response body to a buffer
    const audioBuffer = s3Response.Body as Buffer

    // Create response headers for download
    const headers = new Headers()
    headers.set('Content-Type', s3Response.ContentType || 'audio/ogg')
    headers.set('Content-Length', audioBuffer.length.toString())
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    headers.set('Cache-Control', 'no-cache')
    headers.set('Access-Control-Allow-Origin', '*')

    // Return the audio file as a downloadable response
    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers
    })

  } catch (error: any) {
    rethrowDataPlane(error)
    console.error('Audio Download Error:', error)
    
    if (error.code === 'NoSuchKey') {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
