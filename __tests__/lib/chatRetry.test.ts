import { describe, it, expect } from 'vitest'
import { isRetryableApplyError } from '@/lib/workflow/chatRetry'

describe('isRetryableApplyError', () => {
  it('is not retryable when there is no error', () => {
    expect(isRetryableApplyError(undefined)).toBe(false)
    expect(isRetryableApplyError('')).toBe(false)
  })

  it('is not retryable for truncated/malformed JSON (a length problem, not a fixable mistake)', () => {
    expect(isRetryableApplyError('Response JSON was malformed (likely cut off — try a shorter/simpler request)')).toBe(false)
  })

  it('is retryable for schema, empty-graph, and lint errors', () => {
    expect(isRetryableApplyError('AI returned invalid workflow JSON: nodes: Required')).toBe(true)
    expect(isRetryableApplyError('The AI returned a workflow with no usable nodes — the config is too large to convert in one shot.')).toBe(true)
    expect(isRetryableApplyError("AI returned a broken workflow graph: 'c' can dead-end")).toBe(true)
  })
})
