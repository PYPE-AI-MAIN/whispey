import { describe, it, expect } from 'vitest'
import { extractS3Key } from '@/utils/s3'

describe('extractS3Key', () => {
  it('returns empty string for empty input', () => {
    expect(extractS3Key('')).toBe('')
  })

  it('extracts key from amazonaws.com URL', () => {
    expect(extractS3Key('https://my-bucket.s3.us-east-1.amazonaws.com/folder/file.mp3'))
      .toBe('folder/file.mp3')
  })

  it('extracts nested key from amazonaws.com URL', () => {
    expect(extractS3Key('https://bucket.s3.amazonaws.com/a/b/c/file.wav'))
      .toBe('a/b/c/file.wav')
  })

  it('extracts key from s3:// URL', () => {
    expect(extractS3Key('s3://my-bucket/recordings/call-123.mp3'))
      .toBe('recordings/call-123.mp3')
  })

  it('extracts nested key from s3:// URL', () => {
    expect(extractS3Key('s3://bucket/a/b/c.mp3')).toBe('a/b/c.mp3')
  })

  it('returns input as-is when it looks like a bare key', () => {
    expect(extractS3Key('recordings/file.mp3')).toBe('recordings/file.mp3')
  })

  it('handles URL with no path after amazonaws.com/', () => {
    expect(extractS3Key('https://bucket.s3.amazonaws.com/')).toBe('')
  })
})
