import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FIELD_EXTRACTOR_MODEL,
  FIELD_EXTRACTOR_MODELS,
  isFieldExtractorModel,
  modelChange,
  storedFieldExtractorModel,
} from '@/config/fieldExtractorModels'

describe('field extractor models', () => {
  it('offers the default, Luna, and Sol/Terra as beta', () => {
    expect(FIELD_EXTRACTOR_MODELS.map((m) => [m.value, !!m.beta])).toEqual([
      ['gpt-4.1-mini-2', false],
      ['gpt-5.6-luna', false],
      ['gpt-5.6-sol', true],
      ['gpt-5.6-terra', true],
    ])
    expect(DEFAULT_FIELD_EXTRACTOR_MODEL).toBe('gpt-4.1-mini-2')
  })

  it('only accepts listed deployments', () => {
    expect(isFieldExtractorModel('gpt-5.6-luna')).toBe(true)
    expect(isFieldExtractorModel('gpt-4o')).toBe(false)
    expect(isFieldExtractorModel(null)).toBe(false)
    expect(isFieldExtractorModel(42)).toBe(false)
  })

  it('stores the default as empty', () => {
    expect(storedFieldExtractorModel(DEFAULT_FIELD_EXTRACTOR_MODEL)).toBeNull()
    expect(storedFieldExtractorModel('gpt-5.6-sol')).toBe('gpt-5.6-sol')
  })

  it('sends the model only when it changed', () => {
    expect(modelChange(null, DEFAULT_FIELD_EXTRACTOR_MODEL)).toEqual({})
    expect(modelChange(undefined, DEFAULT_FIELD_EXTRACTOR_MODEL)).toEqual({})
    expect(modelChange('gpt-5.6-luna', 'gpt-5.6-luna')).toEqual({})
    expect(modelChange(null, 'gpt-5.6-luna')).toEqual({ field_extractor_model: 'gpt-5.6-luna' })
    expect(modelChange('gpt-5.6-luna', DEFAULT_FIELD_EXTRACTOR_MODEL)).toEqual({ field_extractor_model: null })
  })
})
