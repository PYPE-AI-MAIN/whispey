import { describe, it, expect } from 'vitest'
import { serializeConfig, prettyPrintConfig, validateConfigSchema, deserializeConfig } from '@/utils/agentConfigSerializer'
import { getDefaultFormValues, buildFormValuesFromAgent } from '@/hooks/useAgentConfig'

const form = (session: any) => {
  const fv: any = getDefaultFormValues()
  fv.advancedSettings.session = { ...fv.advancedSettings.session, ...session }
  return fv
}
const copyThenPaste = (fv: any) => {
  const json = prettyPrintConfig(serializeConfig(fv, {}, {}, {}))
  return { json, valid: validateConfigSchema(json).valid, session: (deserializeConfig(json).formikValues as any).advancedSettings.session }
}

describe('Copy/Paste Config — dynamic user-away fields', () => {
  it('carries mode and instructions through copy -> paste', () => {
    const r = copyThenPaste(form({ user_away_timeout_mode: 'dynamic', user_away_instructions: 'Be formal, Hinglish' }))
    expect(r.json).toContain('user_away_timeout_mode')
    expect(r.valid).toBe(true)
    expect(r.session.user_away_timeout_mode).toBe('dynamic')
    expect(r.session.user_away_instructions).toBe('Be formal, Hinglish')
  })

  it('round-trips the static default', () => {
    expect(copyThenPaste(form({})).session.user_away_timeout_mode).toBe('static')
  })

  it('pastes a config copied before the feature existed without errors', () => {
    const fv = form({})
    delete fv.advancedSettings.session.user_away_timeout_mode
    delete fv.advancedSettings.session.user_away_instructions
    const r = copyThenPaste(fv)
    expect(r.valid).toBe(true)
    expect(r.session.user_away_timeout_mode ?? 'static').toBe('static')
  })

  it('restores a saved agent config (backend shape) into the form', () => {
    const assistant = { llm: { model: 'gpt-4.1-mini' }, prompt: 'hi', session_behavior: { user_away_timeout_mode: 'dynamic', user_away_instructions: 'Be formal' } }
    const s: any = (buildFormValuesFromAgent(assistant, {}) as any).advancedSettings.session
    expect(s.user_away_timeout_mode).toBe('dynamic')
    expect(s.user_away_instructions).toBe('Be formal')
  })
})
