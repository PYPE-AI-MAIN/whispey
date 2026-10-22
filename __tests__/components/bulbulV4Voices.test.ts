import { describe, it, expect } from 'vitest'
import {
  BULBUL_V4_LANGUAGE_CODES,
  BULBUL_V4_MODEL,
  bulbulV4LanguageCode,
  bulbulV4Voices,
  isBulbulV4Model,
} from '@/components/agents/AgentConfig/SelectTTSDialog/bulbulV4Voices'

describe('bulbulV4Voices', () => {
  it('lists every usable v4 speaker exactly once, all tied to the v4 model', () => {
    const ids = bulbulV4Voices.map((v) => v.id)
    expect(ids).toHaveLength(222)
    expect(new Set(ids).size).toBe(ids.length)
    expect(bulbulV4Voices.every((v) => v.compatibleModels.includes(BULBUL_V4_MODEL))).toBe(true)
  })

  it('leaves out Assamese voices, which v4 does not accept yet', () => {
    expect(bulbulV4Voices.some((v) => v.id.split('_')[1] === 'as')).toBe(false)
  })

  it("shows Sarvam's recommended voices first", () => {
    expect(bulbulV4Voices[0].id).toBe('aparna_hi_customer')
    expect(bulbulV4Voices[0].description).toContain('Recommended by Sarvam')
  })

  it('parses name, language and style out of the speaker id', () => {
    const voice = bulbulV4Voices.find((v) => v.id === 'ratan_hi_customer_expressive')
    expect(voice).toMatchObject({ name: 'Ratan', language: 'Hindi', style: 'Customer Expressive', gender: 'Male' })
  })

  it('leaves gender unset where it is not known', () => {
    expect(bulbulV4Voices.find((v) => v.id === 'vetri_ta_ads')?.gender).toBeUndefined()
  })

  it('maps each speaker to the language code v4 expects', () => {
    expect(bulbulV4LanguageCode('aparna_hi_customer')).toBe('hi-IN')
    expect(bulbulV4LanguageCode('simran_en_sales')).toBe('en-IN')
    expect(bulbulV4LanguageCode('simran_enhi_customer')).toBe('hi-IN')
    expect(bulbulV4LanguageCode('gokul_ta_narration')).toBe('ta-IN')
    expect(bulbulV4LanguageCode('anushka')).toBe('en-IN')
  })

  it('recognizes only the v4 model', () => {
    expect(isBulbulV4Model(BULBUL_V4_MODEL)).toBe(true)
    expect(isBulbulV4Model('bulbul:v3-beta')).toBe(false)
    expect(isBulbulV4Model(undefined)).toBe(false)
  })

  it('offers only languages that have v4 voices', () => {
    expect([...BULBUL_V4_LANGUAGE_CODES].sort()).toEqual(
      ['bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN', 'mr-IN', 'pa-IN', 'ta-IN', 'te-IN'],
    )
    const voiceLanguages = new Set(bulbulV4Voices.map((v) => bulbulV4LanguageCode(v.id)))
    expect([...voiceLanguages].sort()).toEqual([...BULBUL_V4_LANGUAGE_CODES].sort())
  })
})
