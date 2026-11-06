export const extractS3Key = (s3Url: string): string => {
  if (!s3Url) return ''
  
  // Handle different S3 URL formats
  if (s3Url.includes('amazonaws.com')) {
    // Format: https://bucket.s3.region.amazonaws.com/key
    const parts = s3Url.split('amazonaws.com/')
    return parts[1] || ''
  } else if (s3Url.includes('s3://')) {
    // Format: s3://bucket/key
    const parts = s3Url.replace('s3://', '').split('/')
    return parts.slice(1).join('/')
  }
  
  return s3Url // Assume it's already a key
}

/** The object key of a customer-held recording (stored by key, never as a URL), or null. Pype calls use recording_url. */
export const routedRecordingKey = (call: { recording_url?: string | null; recording_key?: string | null; voice_recording_key?: string | null; metadata?: Record<string, unknown> | null }): string | null => {
  if (call.recording_url) return null
  const meta = call.metadata ?? {}
  const key = call.recording_key || call.voice_recording_key || (meta.recording_key as string | undefined) || (meta.voice_recording_key as string | undefined)
  return typeof key === 'string' && key.trim() ? key : null
}
