import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lintWorkflow } from '@/lib/workflow/linter'
import { safeParseWorkflow } from '@/lib/workflow/schema'

// The example Pi is shown as "the shape to aim for" must itself be a valid, clean flow.
describe('Pi system prompt example', () => {
  it('parses and lints with no errors or warnings', () => {
    const src = readFileSync('src/app/api/workflow/chat/route.ts', 'utf8').replaceAll('\\`', '`')
    const raw = /Example of a well-shaped flow[\s\S]*?```json\n([\s\S]*?)\n```/.exec(src)?.[1]
    expect(raw, 'example block found').toBeTruthy()
    const parsed = safeParseWorkflow({ transports: { web: { enabled: true } }, variables: [{ key: 'patient_name', type: 'string' }], ...JSON.parse(raw!) })
    expect(parsed.success).toBe(true)
    expect(lintWorkflow(parsed.data!)).toEqual([])
  })
})
