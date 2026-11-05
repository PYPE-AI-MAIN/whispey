import { describe, it, expect } from 'vitest'
import { piModels, isReasoningModel, samplingFor, isPiModelOption, PI_MODEL_OPTIONS, DEFAULT_PI_MODEL } from '@/lib/piModels'

describe('piModels', () => {
  it('defaults to gpt-5.6-luna with gpt-4.1-mini as the fallback on Azure', () => {
    expect(DEFAULT_PI_MODEL).toBe('gpt-5.6-luna')
    expect(piModels({}, true)).toEqual({ primary: 'gpt-5.6-luna', fallback: 'gpt-4.1-mini-2' })
  })

  it('uses the model the user picked, only if it is on the list', () => {
    expect(piModels({}, true, 'gpt-5.6-sol').primary).toBe('gpt-5.6-sol')
    for (const bad of ['gpt-5', 'DeepSeek-V4-Flash', '', null, undefined, 7, {}, 'gpt-5.6-luna; drop']) {
      expect(piModels({}, true, bad).primary).toBe('gpt-5.6-luna')
    }
  })

  it('has no fallback when the pick already is the fallback model', () => {
    expect(piModels({}, true, 'gpt-4.1-mini-2')).toEqual({ primary: 'gpt-4.1-mini-2', fallback: null })
  })

  it('lets env override the default but never the user list', () => {
    expect(piModels({ PI_MODEL: 'gpt-4.1', PI_FALLBACK_MODEL: 'gpt-4.1-nano' }, true)).toEqual({ primary: 'gpt-4.1', fallback: 'gpt-4.1-nano' })
    expect(piModels({ PI_MODEL: 'gpt-4.1' }, true, 'gpt-5.6-terra').primary).toBe('gpt-5.6-terra')
  })

  it('on plain OpenAI ignores the pick and keeps the old default, with no fallback', () => {
    expect(piModels({}, false, 'gpt-5.6-sol')).toEqual({ primary: 'gpt-4o-mini', fallback: null })
    expect(piModels({ AZURE_DEPLOYMENT_NAME: 'x' }, false).primary).toBe('x')
  })

  it('only lists models the server will accept, and knows which reject temperature', () => {
    expect(PI_MODEL_OPTIONS.every((o) => isPiModelOption(o.id))).toBe(true)
    expect(['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'].every(isReasoningModel)).toBe(true)
    expect(['gpt-4.1', 'gpt-4.1-mini-2', 'gpt-4o-mini'].some(isReasoningModel)).toBe(false)
    expect(samplingFor('gpt-5.6-luna', 0.2)).toEqual({})
    expect(samplingFor('gpt-4.1', 0.2)).toEqual({ temperature: 0.2 })
  })
})
