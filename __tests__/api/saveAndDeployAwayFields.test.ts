import { describe, it, expect, vi, beforeEach } from 'vitest'

const deploy = vi.fn(async (..._args: any[]) => ({ ok: true, status: 200, data: {} }))
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'u1' }) }))
vi.mock('@/lib/supabase-server', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/deployAgentConfig', () => ({ deployAgentConfig: (...a: any[]) => deploy(...a) }))
vi.mock('@/lib/resolveDeploymentTarget', () => ({ resolveDeploymentTargetForUser: async () => 'classic' }))
vi.mock('@/lib/whispey-crypto', () => ({ decryptWithWhispeyKey: () => '' }))

import { POST } from '@/app/api/agents/save-and-deploy/route'
import { getDefaultFormValues } from '@/hooks/useAgentConfig'
import { DEFAULT_AWAY_INSTRUCTIONS } from '@/config/agentDefaults'
import { buildAssistantSessionBehaviorPayload } from '@/hooks/useMultiAssistantState'

const formWith = (session: any) => {
  const fv: any = getDefaultFormValues()
  fv.advancedSettings.session = { ...fv.advancedSettings.session, ...session }
  return fv
}
const post = async (session: any) => {
  const req: any = {
    json: async () => ({
      formikValues: formWith(session),
      assistantName: 'Asha',
      agentSettings: { prompt: 'You are Asha.' },
      sttConfiguration: { provider: 'deepgram', model: 'nova-3', config: { language: 'en' } },
      llmConfiguration: { provider: 'openai', model: 'gpt-4.1-mini', temperature: 0.3 },
      ttsConfiguration: { provider: 'elevenlabs', model: 'eleven_flash_v2_5', config: { voice_id: 'abc', language: 'en' } },
      metadata: { agentName: 'e2e_agent', agentId: null },
    }),
  }
  const res: any = await POST(req)
  expect(res.status).toBe(200)
  return (deploy.mock.calls.at(-1) as any[])[1].agent.assistant[0].session_behavior
}

describe('save payload carries the dynamic user-away fields', () => {
  beforeEach(() => deploy.mockClear())

  it('save-and-deploy route (form structure)', async () => {
    const sb = await post({ user_away_timeout_mode: 'dynamic', user_away_instructions: 'Be formal, Hinglish' })
    expect(sb.user_away_timeout_mode).toBe('dynamic')
    expect(sb.user_away_instructions).toBe('Be formal, Hinglish')
  })

  it('route omits empty instructions and defaults to static', async () => {
    const sb = await post({ user_away_instructions: '' })
    expect(sb.user_away_timeout_mode).toBe('static')
    expect('user_away_instructions' in sb).toBe(false)
  })

  it('does not send the built-in default text (the backend default keeps applying)', async () => {
    const sb = await post({ user_away_timeout_mode: 'dynamic', user_away_instructions: DEFAULT_AWAY_INSTRUCTIONS })
    expect(sb.user_away_timeout_mode).toBe('dynamic')
    expect('user_away_instructions' in sb).toBe(false)
  })

  it('sends instructions the owner customised, trimmed', async () => {
    const sb = await post({ user_away_timeout_mode: 'dynamic', user_away_instructions: '  Be brief and formal.  ' })
    expect(sb.user_away_instructions).toBe('Be brief and formal.')
  })

  it('a new agent saved without touching anything stays static with no instructions', async () => {
    const sb = await post({})
    expect(sb.user_away_timeout_mode).toBe('static')
    expect('user_away_instructions' in sb).toBe(false)
  })

  it('coexists with the eod_silence_seconds setting in the same payload', async () => {
    const sb = await post({ user_away_timeout_mode: 'dynamic', user_away_instructions: 'Be formal', eod_silence_seconds: 5 })
    expect(sb.user_away_timeout_mode).toBe('dynamic')
    expect(sb.user_away_instructions).toBe('Be formal')
    expect(sb.eod_silence_seconds).toBe(5)
  })

  it('multi-assistant payload builder', () => {
    const sb = buildAssistantSessionBehaviorPayload(formWith({ user_away_timeout_mode: 'dynamic', user_away_instructions: 'Be brief' }))
    expect(sb.user_away_timeout_mode).toBe('dynamic')
    expect(sb.user_away_instructions).toBe('Be brief')
    expect('user_away_instructions' in buildAssistantSessionBehaviorPayload(formWith({ user_away_instructions: '' }))).toBe(false)
    expect('user_away_instructions' in buildAssistantSessionBehaviorPayload(formWith({ user_away_instructions: DEFAULT_AWAY_INSTRUCTIONS }))).toBe(false)
    const both = buildAssistantSessionBehaviorPayload(formWith({ user_away_timeout_mode: 'dynamic', eod_silence_seconds: 7 }))
    expect(both.user_away_timeout_mode).toBe('dynamic')
    expect(both.eod_silence_seconds).toBe(7)
  })
})
