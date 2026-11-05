import { describe, it, expect } from 'vitest'
import { buildSpec } from '@/components/agents/AgentConfig/AgentAdvancedSettings/ConfigParents/InboundVariablesSettings'

// The spec is what a customer's developer copies and builds against, so it has
// to carry THIS agent's real variable names and the real deadline.
describe('inbound variables spec', () => {
  it('uses the agent\'s own variable names', () => {
    const spec = buildSpec('https://crm.test/lookup', ['patient_name', 'branch'], 1000)
    expect(spec).toContain('"patient_name"')
    expect(spec).toContain('"branch"')
    expect(spec).toContain('POST https://crm.test/lookup')
  })

  it('states the deadline the endpoint must meet', () => {
    expect(buildSpec('https://x', ['name'], 700)).toContain('700 ms')
  })

  it('falls back to example names before any variables exist', () => {
    const spec = buildSpec('', [], 1000)
    expect(spec).toContain('patient_name')
    expect(spec).toContain('your-system.example.com')
  })

  it('always documents the unknown-caller and failure cases', () => {
    const spec = buildSpec('https://x', ['name'], 1000)
    expect(spec).toContain('"variables": {}')
    expect(spec).toContain('default values')
  })
})
