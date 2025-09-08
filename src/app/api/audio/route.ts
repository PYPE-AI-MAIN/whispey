import { NextRequest, NextResponse } from 'next/server'
import AWS from 'aws-sdk'

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
})

function parseS3Url(inputUrl: string): { bucket?: string; key?: string } {
  try {
    const url = new URL(inputUrl)
    // Virtual-hosted–style: <bucket>.s3.<region>.amazonaws.com/<key>
    const hostParts = url.hostname.split('.')
    let bucket: string | undefined
    if (hostParts.length >= 4 && hostParts[1] === 's3') {
      bucket = hostParts[0]
    }
    // Path-style: s3.<region>.amazonaws.com/<bucket>/<key>
    if (!bucket && hostParts[0] === 's3') {
      const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
      const firstSlash = path.indexOf('/')
      if (firstSlash > 0) {
        bucket = path.substring(0, firstSlash)
        const key = path.substring(firstSlash + 1)
        return { bucket, key }
      }
    }
    // For virtual-hosted style, key is entire path without leading '/'
    const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
    return { bucket, key }
  } catch (_e) {
    return {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const { s3Key, url } = await request.json()

    let bucket = process.env.AWS_S3_BUCKET as string | undefined
    let key = s3Key as string | undefined

    if (url && !key) {
      const parsed = parseS3Url(url)
      if (parsed.bucket) bucket = parsed.bucket
      if (parsed.key) key = parsed.key
    }

    if (!key) {
      return NextResponse.json({ error: 'S3 key or valid S3 URL required' }, { status: 400 })
    }
    if (!bucket) {
      return NextResponse.json({ error: 'S3 bucket not specified and could not be inferred' }, { status: 400 })
    }

    // Generate presigned URL (valid for 1 hour)
    const signedUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: 3600 // 1 hour
    })

    return NextResponse.json({ url: signedUrl, bucket, key })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 })
  }
}