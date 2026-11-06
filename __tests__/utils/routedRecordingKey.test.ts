import { describe, it, expect } from 'vitest'
import { routedRecordingKey } from '@/utils/s3'

const KEY = 'recordings/88f5145b-90c4-44e3-aacb-5b15ea24a159/3cb88d8a-d6f5-45f4-a94b-75d307b8fabd.ogg'

describe('routedRecordingKey', () => {
  it('a Pype call (recording_url set) keeps its URL path: no key', () => {
    expect(routedRecordingKey({ recording_url: 'https://b.s3.us-east-2.amazonaws.com/x.ogg', recording_key: KEY })).toBeNull()
  })
  it('a customer-held call has the key and no URL', () => {
    expect(routedRecordingKey({ recording_url: '', recording_key: KEY })).toBe(KEY)
    expect(routedRecordingKey({ voice_recording_key: KEY })).toBe(KEY)
  })
  it('falls back to the key stored in metadata', () => {
    expect(routedRecordingKey({ metadata: { voice_recording_key: KEY } })).toBe(KEY)
  })
  it('no recording at all gives null', () => {
    expect(routedRecordingKey({})).toBeNull()
    expect(routedRecordingKey({ recording_key: '  ' })).toBeNull()
  })
})
