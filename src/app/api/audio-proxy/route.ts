import { NextRequest, NextResponse } from 'next/server'
import AWS from 'aws-sdk'

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
})

function parseS3Url(inputUrl: string): { bucket?: string; key?: string; host?: string } {
  try {
    const url = new URL(inputUrl)
    const hostParts = url.hostname.split('.')
    let bucket: string | undefined
    if (hostParts.length >= 4 && hostParts[1] === 's3') {
      bucket = hostParts[0]
    }
    if (!bucket && hostParts[0] === 's3') {
      const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
      const firstSlash = path.indexOf('/')
      if (firstSlash > 0) {
        bucket = path.substring(0, firstSlash)
        const key = path.substring(firstSlash + 1)
        return { bucket, key, host: url.hostname }
      }
    }
    const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
    return { bucket, key, host: url.hostname }
  } catch {
    return {}
  }
}

function resolveBucketName(
  bucketFromUrl: string | undefined,
  key: string | undefined,
  host: string | undefined
): string | undefined {
  if (bucketFromUrl) return bucketFromUrl
  const haystack = `${host || ''}/${key || ''}`.toLowerCase()
  const firstSeg = (key || '').split('/')[0].toLowerCase()

  // Prefer explicit env mapping if we detect known identifiers
  if (haystack.includes('samunati') || firstSeg.includes('samunati')) {
    return process.env.AWS_S3_BUCKET_SAMUNATI || process.env.AWS_S3_BUCKET
  }
  if (haystack.includes('kannada') || firstSeg.includes('kannada')) {
    return process.env.AWS_S3_BUCKET_KANNADA || process.env.AWS_S3_BUCKET
  }
  // Fallback to default bucket
  return process.env.AWS_S3_BUCKET
}

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
        const hasExpires = urlObj.searchParams.has('X-Amz-Expires')

        const isPresignedShape = hasSignature && hasCredential && hasDate

        // If looks presigned, also verify not expired using X-Amz-Date + X-Amz-Expires
        let isExpired = false
        if (isPresignedShape && hasExpires) {
          const dateStr = urlObj.searchParams.get('X-Amz-Date') || '' // e.g., 20250830T072725Z
          const expiresStr = urlObj.searchParams.get('X-Amz-Expires') || '0'
          const y = Number(dateStr.substring(0, 4))
          const m = Number(dateStr.substring(4, 6)) - 1
          const d = Number(dateStr.substring(6, 8))
          const hh = Number(dateStr.substring(9, 11))
          const mm = Number(dateStr.substring(11, 13))
          const ss = Number(dateStr.substring(13, 15))
          const baseMs = Date.UTC(y, m, d, hh, mm, ss)
          const ttlSec = Number(expiresStr)
          const expiresAt = baseMs + ttlSec * 1000
          isExpired = Number.isFinite(expiresAt) && Date.now() > expiresAt
        }

        if (isPresignedShape && !isExpired) {
          console.log('Valid S3 presigned URL detected, allowing client-side access')
          return NextResponse.json({
            accessible: true,
            status: 200,
            statusText: 'OK',
            contentType: 'audio/ogg',
            contentLength: null,
            url: url,
            isS3PresignedUrl: true
          })
        }
        // Not a valid presigned URL or expired; try re-signing using our AWS creds
        const { bucket, key, host } = parseS3Url(url)
        const effectiveBucket = resolveBucketName(bucket, key, host)
        if (effectiveBucket && key) {
          try {
            const resigned = await s3.getSignedUrlPromise('getObject', {
              Bucket: effectiveBucket,
              Key: key,
              Expires: 3600
            })
            return NextResponse.json({
              accessible: true,
              status: 200,
              statusText: 'OK',
              url: resigned,
              isS3PresignedUrl: true,
              resigned: true,
              bucket: effectiveBucket,
              key
            })
          } catch (signErr) {
            console.log('Failed to re-sign S3 URL:', signErr)
          }
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
    const filename = searchParams.get('filename') || undefined

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
    if (filename) {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    }
    
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