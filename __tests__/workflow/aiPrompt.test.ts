import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WORKFLOW_AI_PROMPT } from '@/lib/workflow/aiPrompt'
import { lintWorkflow } from '@/lib/workflow/linter'
import { safeParseWorkflow } from '@/lib/workflow/schema'

describe('copy-a-prompt for any AI', () => {
  it('the example inside the prompt is a valid, clean workflow', () => {
    const start = WORKFLOW_AI_PROMPT.indexOf('EXAMPLE OF THE RIGHT SIZE AND SHAPE')
    const json = WORKFLOW_AI_PROMPT.slice(WORKFLOW_AI_PROMPT.indexOf('{', start), WORKFLOW_AI_PROMPT.indexOf('MY AGENT')).trim()
    const parsed = safeParseWorkflow(JSON.parse(json))
    expect(parsed.success).toBe(true)
    expect(lintWorkflow(parsed.data!)).toEqual([])
  })

  it('the docs page holds exactly the same prompt', () => {
    const page = readFileSync('docs-site/content/workflows/build-with-ai.mdx', 'utf8')
    const block = /```text\n([\s\S]*?)\n```/.exec(page)?.[1]
    expect(block).toBe(WORKFLOW_AI_PROMPT.trimEnd())
  })

  it('names every step type the editor can import without rejecting', () => {
    for (const type of ['conversation', 'extract_variable', 'logic_split', 'function', 'call_transfer', 'ending']) {
      expect(WORKFLOW_AI_PROMPT).toContain(type)
    }
  })
})
