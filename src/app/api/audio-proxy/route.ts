import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url, method = 'HEAD' } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    console.log(`Audio Proxy: ${method} request to ${url}`)

    // Check if this is an S3 URL
    const isS3Url = url.includes('.s3.') || url.includes('.amazonaws.com')
    
    if (isS3Url && method.toUpperCase() === 'HEAD') {
      // For S3 URLs, validate the URL structure instead of making a server request
      // S3 presigned URLs often work from browser but not from server due to CORS
      try {
        const urlObj = new URL(url)
        const hasSignature = urlObj.searchParams.has('X-Amz-Signature')
        const hasCredential = urlObj.searchParams.has('X-Amz-Credential')
        const hasDate = urlObj.searchParams.has('X-Amz-Date')
        
        const isValidS3PresignedUrl = hasSignature && hasCredential && hasDate
        
        if (isValidS3PresignedUrl) {
          console.log('Valid S3 presigned URL detected, allowing client-side access')
          return NextResponse.json({
            accessible: true,
            status: 200,
            statusText: 'OK',
            contentType: 'audio/ogg', // Assume audio content
            contentLength: null,
            url: url,
            isS3PresignedUrl: true // Flag for client to use direct access
          })
        }
      } catch (err) {
        console.log('Failed to validate S3 URL structure:', err)
      }
    }

    // Make the proxied request for non-S3 URLs or GET requests
    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        'User-Agent': 'Pype-Voice-Analytics/1.0',
        'Accept': 'audio/*,*/*;q=0.9',
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    // For HEAD requests, we just need to check if the URL is accessible
    if (method.toUpperCase() === 'HEAD') {
      return NextResponse.json({
        accessible: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        url: url // Return the original URL if accessible
      })
    }

    // For GET requests, stream the audio content
    if (method.toUpperCase() === 'GET') {
      if (!response.ok) {
        return NextResponse.json(
          { error: `Audio not accessible: ${response.status} ${response.statusText}` },
          { status: response.status }
        )
      }

      // Stream the audio content back to client
      const headers = new Headers()
      
      // Copy relevant headers from the original response
      const contentType = response.headers.get('content-type')
      if (contentType) headers.set('Content-Type', contentType)
      
      const contentLength = response.headers.get('content-length')
      if (contentLength) headers.set('Content-Length', contentLength)
      
      headers.set('Accept-Ranges', 'bytes')
      headers.set('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
      
      return new NextResponse(response.body, {
        status: 200,
        headers
      })
    }

    return NextResponse.json(
      { error: 'Method not supported' },
      { status: 405 }
    )

  } catch (error: any) {
    console.error('Audio Proxy Error:', error)
    
    if (error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout - audio URL not accessible' },
        { status: 408 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint for direct audio streaming with URL parameter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const audioUrl = searchParams.get('url')

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(audioUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Check if this is an S3 URL - if so, redirect to direct access
    const isS3Url = audioUrl.includes('.s3.') || audioUrl.includes('.amazonaws.com')
    if (isS3Url) {
      // For S3 presigned URLs, redirect client to use the URL directly
      return NextResponse.redirect(audioUrl)
    }

    console.log(`Audio Proxy GET: Streaming audio from ${audioUrl}`)

    const response = await fetch(audioUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Pype-Voice-Analytics/1.0',
        'Accept': 'audio/*,*/*;q=0.9',
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout for streaming
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Audio not accessible: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    // Stream the audio content
    const headers = new Headers()
    
    const contentType = response.headers.get('content-type')
    if (contentType) headers.set('Content-Type', contentType)
    
    const contentLength = response.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)
    
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Cache-Control', 'public, max-age=3600')
    
    return new NextResponse(response.body, {
      status: 200,
      headers
    })

  } catch (error: any) {
    console.error('Audio Proxy GET Error:', error)
    
    if (error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout - audio URL not accessible' },
        { status: 408 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 