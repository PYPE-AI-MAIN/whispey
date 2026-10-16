import { describe, it, expect } from 'vitest'
import { serializeConfig, prettyPrintConfig, validateConfigSchema, deserializeConfig } from '@/utils/agentConfigSerializer'
import { getDefaultFormValues, buildFormValuesFromAgent } from '@/hooks/useAgentConfig'
import { AGENT_DEFAULT_CONFIG, DEFAULT_AWAY_INSTRUCTIONS, customAwayInstructions } from '@/config/agentDefaults'
import { MCP_AGENT_DEFAULT_CONFIG } from '@/config/mcpAgentDefaults'

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


describe('new agents default to static', () => {
  it('UI form defaults for a new agent are static', () => {
    expect((getDefaultFormValues() as any).advancedSettings.session.user_away_timeout_mode).toBe('static')
    expect(AGENT_DEFAULT_CONFIG.session_behavior.user_away_timeout_mode).toBe('static')
  })

  it('agents created through the MCP default to static', () => {
    expect(MCP_AGENT_DEFAULT_CONFIG.session_behavior.user_away_timeout_mode).toBe('static')
  })

  it('an agent saved before this feature loads as static', () => {
    const s: any = (buildFormValuesFromAgent({ llm: { model: 'gpt-4.1-mini' }, prompt: 'hi', session_behavior: { user_away_timeout: 5 } }, {}) as any).advancedSettings.session
    expect(s.user_away_timeout_mode).toBe('static')
  })

  it('a copied config with no mode still pastes as static', () => {
    const fv: any = getDefaultFormValues()
    delete fv.advancedSettings.session.user_away_timeout_mode
    const json = prettyPrintConfig(serializeConfig(fv, {}, {}, {}))
    const pasted: any = deserializeConfig(json).formikValues
    expect(pasted.advancedSettings.session.user_away_timeout_mode ?? 'static').toBe('static')
  })
})

describe('default away instructions', () => {
  it('is a real, bounded prompt that fits the 1000 char limit', () => {
    expect(DEFAULT_AWAY_INSTRUCTIONS.length).toBeGreaterThan(100)
    expect(DEFAULT_AWAY_INSTRUCTIONS.length).toBeLessThan(1000)
  })

  it('new agents start with no custom instructions (the default applies)', () => {
    expect((getDefaultFormValues() as any).advancedSettings.session.user_away_instructions).toBeUndefined()
  })

  it.each([undefined, null, '', '   ', 42, DEFAULT_AWAY_INSTRUCTIONS, `  ${DEFAULT_AWAY_INSTRUCTIONS}\n`])(
    'does not save %j as custom instructions',
    (v) => expect(customAwayInstructions(v)).toBeUndefined()
  )

  it('saves only what the owner actually wrote, trimmed', () => {
    expect(customAwayInstructions('  Be formal, Hinglish  ')).toBe('Be formal, Hinglish')
    expect(customAwayInstructions(DEFAULT_AWAY_INSTRUCTIONS + ' Mention the doctor.')).toContain('Mention the doctor.')
  })
})
