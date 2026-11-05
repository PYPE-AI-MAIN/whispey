import { describe, it, expect } from 'vitest'
import { PI_ANALYTICS_RECIPES_DOC, callVolumeTrendSpec } from '@/lib/piAnalyticsRecipes'
import { PI_AGENT_INTELLIGENCE_DOC } from '@/lib/piAgentIntelligence'
import { PI_MODEL_HISTORY_TURNS, piPlatformSchemaDoc } from '@/lib/piPlatformSchema'
import { DISPOSITION_SUGGESTIONS } from '@/lib/dispositions'
import { Spec } from '@/server/analytics/spec'

/** Every top-level {...} JSON object that starts with "spec_version" in the doc, found by brace matching. */
function recipeSpecs(doc: string): string[] {
  const out: string[] = []
  let from = 0
  for (;;) {
    const start = doc.indexOf('{ "spec_version"', from)
    if (start < 0) return out
    let depth = 0
    let end = start
    for (let i = start; i < doc.length; i++) {
      if (doc[i] === '{') depth++
      if (doc[i] === '}' && --depth === 0) { end = i + 1; break }
    }
    out.push(doc.slice(start, end))
    from = end
  }
}

describe('Pi analytics recipes', () => {
  it('callVolumeTrendSpec is a valid daily-count spec for the requested range', () => {
    const spec = callVolumeTrendSpec(14)
    expect(spec).toMatchObject({ spec_version: 1, source: 'voice', bucket: 'day', range: { days: 14 }, agg: { fn: 'count' } })
    expect(Spec.safeParse(spec).success).toBe(true)
    expect(callVolumeTrendSpec().range.days).toBe(30)
  })

  it('every runnable JSON recipe in the prompt validates against the real query schema', () => {
    const runnable = recipeSpecs(PI_ANALYTICS_RECIPES_DOC).filter((s) => !s.includes('<')) // skip the one with a <ref from catalog> placeholder
    expect(runnable.length).toBeGreaterThanOrEqual(5)
    for (const text of runnable) {
      const parsed = Spec.safeParse(JSON.parse(text))
      expect(parsed.success, `recipe does not validate:\n${text}\n${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true)
    }
  })

  it('tells Pi not to invent timestamp dimensions', () => {
    expect(PI_ANALYTICS_RECIPES_DOC).toContain('call_start_time')
  })
})

describe('Pi prompt documents', () => {
  it('agent intelligence covers every section Pi relies on, with no stray whitespace', () => {
    for (const section of ['GENERAL', 'TOOLS', 'CONFIG VS PROMPT', 'LANGUAGE', 'LEAD QUALIFICATION', 'INBOUND', 'APPOINTMENT REMINDER']) {
      expect(PI_AGENT_INTELLIGENCE_DOC).toContain(section)
    }
    expect(PI_AGENT_INTELLIGENCE_DOC).toBe(PI_AGENT_INTELLIGENCE_DOC.trim())
    expect(PI_AGENT_INTELLIGENCE_DOC).toContain('<transfer/>')
  })

  it('platform schema lists every disposition suggestion and keeps a bounded history window', () => {
    const doc = piPlatformSchemaDoc()
    expect(PI_MODEL_HISTORY_TURNS).toBe(24)
    for (const s of DISPOSITION_SUGGESTIONS) expect(doc).toContain(s.key)
    expect(piPlatformSchemaDoc()).toBe(doc) // pure: same output every call
  })
})
