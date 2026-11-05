import { describe, it, expect } from 'vitest'
import { parseWorkflow } from '@/lib/workflow/schema'
import { lintWorkflow } from '@/lib/workflow/linter'

const transfer = { id: 't', type: 'call_transfer', transferTo: '+911234567890', preTransferWebhookUrl: 'https://x.test/{{missing_var}}', preTransferWebhookFields: ['transcript'] }
const wf = { schemaVersion: '1.0', metadata: { name: 'x' }, start: 't', nodes: [transfer], edges: [], globalRules: [], variables: [] }

describe('pre-transfer webhook on a transfer step', () => {
  it('keeps the address and the chosen fields when the flow is parsed', () => {
    const node = parseWorkflow(wf).nodes[0] as typeof transfer
    expect(node.preTransferWebhookUrl).toBe('https://x.test/{{missing_var}}')
    expect(node.preTransferWebhookFields).toEqual(['transcript'])
  })

  it('checks {{variables}} in the address like every other text field', () => {
    const issues = lintWorkflow(parseWorkflow(wf))
    expect(issues.some((i) => i.message.includes('missing_var'))).toBe(true)
  })
})
