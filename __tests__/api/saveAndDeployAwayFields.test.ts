import { describe, it, expect, vi, beforeEach } from 'vitest'

const deploy = vi.fn(async (..._args: any[]) => ({ ok: true, status: 200, data: {} }))
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'u1' }) }))
vi.mock('@/lib/supabase-server', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/deployAgentConfig', () => ({ deployAgentConfig: (...a: any[]) => deploy(...a) }))
vi.mock('@/lib/resolveDeploymentTarget', () => ({ resolveDeploymentTargetForUser: async () => 'classic' }))
vi.mock('@/lib/whispey-crypto', () => ({ decryptWithWhispeyKey: () => '' }))

import { POST } from '@/app/api/agents/save-and-deploy/route'
import { getDefaultFormValues } from '@/hooks/useAgentConfig'
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
    const sb = await post({ user_away_timeout_mode: 'dynamic' })
    expect(sb.user_away_timeout_mode).toBe('dynamic')
  })

  it('a new agent saved without touching anything stays static', async () => {
    const sb = await post({})
    expect(sb.user_away_timeout_mode).toBe('static')
  })

  it('coexists with the eod_silence_seconds setting in the same payload', async () => {
    const sb = await post({ user_away_timeout_mode: 'dynamic', eod_silence_seconds: 5 })
    expect(sb.user_away_timeout_mode).toBe('dynamic')
    expect(sb.eod_silence_seconds).toBe(5)
  })

  it('sends a custom dynamic message prompt, trimmed', async () => {
    const sb = await post({ user_away_timeout_mode: 'dynamic', user_away_prompt: '  Write one calm line.  ' })
    expect(sb.user_away_prompt).toBe('Write one calm line.')
  })

  it.each([
    ['undefined', undefined], ['null', null], ['an empty string', ''], ['blank text', '   '],
    ['a number', 42], ['text over the cap', 'x'.repeat(6001)],
  ])('does not send %s as a dynamic message prompt', async (_label, v) => {
    const sb = await post({ user_away_timeout_mode: 'dynamic', user_away_prompt: v })
    expect('user_away_prompt' in sb).toBe(false)
  })

  it('the multi-assistant builder carries the prompt only when the owner wrote one', () => {
    expect(buildAssistantSessionBehaviorPayload(formWith({ user_away_prompt: ' Be brief. ' })).user_away_prompt).toBe('Be brief.')
    expect('user_away_prompt' in buildAssistantSessionBehaviorPayload(formWith({ user_away_prompt: '' }))).toBe(false)
    expect('user_away_prompt' in buildAssistantSessionBehaviorPayload(formWith({}))).toBe(false)
  })

  it('multi-assistant payload builder', () => {
    const sb = buildAssistantSessionBehaviorPayload(formWith({ user_away_timeout_mode: 'dynamic' }))
    expect(sb.user_away_timeout_mode).toBe('dynamic')
    const both = buildAssistantSessionBehaviorPayload(formWith({ user_away_timeout_mode: 'dynamic', eod_silence_seconds: 7 }))
    expect(both.user_away_timeout_mode).toBe('dynamic')
    expect(both.eod_silence_seconds).toBe(7)
  })
})
