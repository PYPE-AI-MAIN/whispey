import { describe, it, expect } from 'vitest'
import { deserializeToolConfig, getDefaultToolName } from '@/hooks/useAgentConfig'

describe('getDefaultToolName', () => {
  it('returns the mapped display name for voicemail_detection', () => {
    // Regression test: this entry was missing from DEFAULT_TOOL_NAMES, which
    // caused the tool's display name to fall back to "Custom Tool" after an
    // agent update instead of showing "Voicemail Detection".
    expect(getDefaultToolName('voicemail_detection')).toBe('Voicemail Detection')
  })

  it('falls back to "Custom Tool" for an unmapped type', () => {
    expect(getDefaultToolName('some_unknown_tool_type')).toBe('Custom Tool')
  })
})

describe('deserializeToolConfig — voicemail_detection fields', () => {
  it('reads vm_message and vm_wait_timeout back from the saved tool', () => {
    const tool = { vm_message: 'Please call back soon', vm_wait_timeout: 10 }
    const result = deserializeToolConfig(tool)
    expect(result.vm_message).toBe('Please call back soon')
    expect(result.vm_wait_timeout).toBe(10)
  })

  it('falls back to real defaults when the fields are missing entirely', () => {
    const result = deserializeToolConfig({})
    expect(result.vm_message).toMatch(/reached a voicemail/)
    expect(result.vm_wait_timeout).toBe(7)
  })

  it('preserves a blank saved vm_message instead of reverting to the default (?? not ||)', () => {
    const tool = { vm_message: '', vm_wait_timeout: 10 }
    const result = deserializeToolConfig(tool)
    expect(result.vm_message).toBe('')
  })

  it('preserves a saved 0 vm_wait_timeout instead of reverting to the default (?? not ||)', () => {
    const tool = { vm_message: 'Bye', vm_wait_timeout: 0 }
    const result = deserializeToolConfig(tool)
    expect(result.vm_wait_timeout).toBe(0)
  })
})
