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