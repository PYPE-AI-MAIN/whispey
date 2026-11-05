import { describe, it, expect, vi, afterEach } from 'vitest'
import { groundedValues, llmDeclaredValues } from '@/server/analytics/llmValues'
import { applyDeclarations } from '@/server/analytics/extractor'

const PROMPT_TEXT = 'Return exactly one of these values, spelled exactly as written: wrong_number | voicemail | needs_human'

describe('values read by the model are only kept when the prompt contains them', () => {
  it('keeps values that appear in the prompt, in the order given', () => {
    expect(groundedValues(PROMPT_TEXT, ['wrong_number', 'voicemail', 'needs_human'])).toEqual(['wrong_number', 'voicemail', 'needs_human'])
  })

  it('drops a value the prompt never mentions', () => {
    expect(groundedValues(PROMPT_TEXT, ['wrong_number', 'voicemail', 'invented_label'])).toEqual(['wrong_number', 'voicemail'])
  })

  it('leaves a 1 / 0 / - score alone, but keeps labels that merely include None', () => {
    expect(groundedValues('Score: 1 if correct, 0 if not, - if it does not apply', ['1', '0', '-'])).toBeNull()
    expect(groundedValues('Return one of: Guided, Aware, Null', ['Guided', 'Aware', 'Null'])).toEqual(['Guided', 'Aware', 'Null'])
  })

  it('gives nothing when fewer than two real values are left, or the answer is not a list', () => {
    expect(groundedValues(PROMPT_TEXT, ['wrong_number', 'invented_label'])).toBeNull()
    expect(groundedValues(PROMPT_TEXT, 'wrong_number')).toBeNull()
    expect(groundedValues(PROMPT_TEXT, [])).toBeNull()
  })
})

describe('without a model configured', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('finds nothing and does not throw, so the pattern-based reading is used', async () => {
    vi.stubEnv('AZURE_OPENAI_API_KEY', '')
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', '')
    vi.stubEnv('OPENAI_API_KEY', '')
    const prompt = JSON.stringify([{ key: 'final_disposition', description: PROMPT_TEXT }])
    expect((await llmDeclaredValues(prompt)).size).toBe(0)
  })
})

describe('applying model-read values', () => {
  const row = (path: string[], over = {}) => ({
    col: 'transcription_metrics', path, value_type: 'string', boolean_encoding: null, enum_values: null, type_confirmed: false, ...over,
  })
  const prompt = JSON.stringify([
    { key: 'final_disposition', description: PROMPT_TEXT },
    { key: 'is_unassured', description: 'Context: a call. **INDICATORS (Score 1)**: the patient did not commit. **NOT (Score 0)**: the patient committed.' },
  ])

  it('uses the model-read list as the declared labels, then anything else the calls produced', () => {
    const [out] = applyDeclarations(
      [row(['final_disposition'], { enum_values: ['voicemail', 'surprise'] })],
      prompt,
      { includeDescription: false, llmValues: new Map([['final_disposition', ['wrong_number', 'voicemail', 'needs_human']]]) }
    )
    expect(out.value_type).toBe('enum')
    expect(out.enum_values).toEqual(['wrong_number', 'voicemail', 'needs_human', 'surprise'])
  })

  it('never lets the model turn a Score 1 / Score 0 field into labels', () => {
    const [out] = applyDeclarations(
      [row(['is_unassured'])],
      prompt,
      { includeDescription: false, llmValues: new Map([['is_unassured', ['yes', 'no']]]) }
    )
    expect(out.value_type).toBe('boolean')
    expect(out.boolean_encoding).toBe('one_zero')
  })
})
