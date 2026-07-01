import { describe, it, expect, vi, beforeEach } from 'vitest'

import { saveSupplementalSettings } from '@/lib/supplementalSettings'
import type { WebhookConfig, DropoffConfig, CallbackConfig } from '@/lib/supplementalSettings'

// ── Helpers ────────────────────────────────────────────────────────────────────

const AGENT_ID = 'agent-123'
const PROJECT_ID = 'project-456'

const WEBHOOK: WebhookConfig = {
  webhookUrl: 'https://example.com/hook',
  httpMethod: 'POST',
  headers: {},
  isActive: true,
}

const DROPOFF: DropoffConfig = {
  enabled: true,
  dropoff_message: 'We will call back.',
  delay_minutes: 5,
  max_retries: 3,
  context_dropoff_prompt: '',
  call_retry_required_criteria: '',
  sip_trunk_id: null,
  phone_number_id: null,
}

const CALLBACK: CallbackConfig = {
  enabled: true,
  timeWindow: { startTime: '09:00', endTime: '18:00' },
  allowedDays: ['monday', 'tuesday'],
  timezone: 'UTC',
  phoneNumberId: null,
  sipTrunkId: null,
  maxFutureDays: 7,
  maxCallbacksPerContact: 3,
  defaultDelayMinutes: 30,
  minDelayMinutes: 2,
}

function mockFetchOk() {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
}

function mockFetchFail(status = 400) {
  return vi.fn().mockResolvedValue({ ok: false, status })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('saveSupplementalSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchOk())
  })

  it('resolves without error when all settings succeed', async () => {
    await expect(
      saveSupplementalSettings(AGENT_ID, PROJECT_ID, { webhook: WEBHOOK, dropoff: DROPOFF, callbackScheduling: CALLBACK })
    ).resolves.toBeUndefined()
  })

  it('calls webhook endpoint when webhook is provided', async () => {
    const fetch = mockFetchOk()
    vi.stubGlobal('fetch', fetch)
    await saveSupplementalSettings(AGENT_ID, PROJECT_ID, { webhook: WEBHOOK })
    expect(fetch).toHaveBeenCalledWith('/api/webhooks/config', expect.objectContaining({ method: 'POST' }))
  })

  it('calls DELETE for webhook when inactive and URL is empty', async () => {
    const fetch = mockFetchOk()
    vi.stubGlobal('fetch', fetch)
    await saveSupplementalSettings(AGENT_ID, PROJECT_ID, {
      webhook: { ...WEBHOOK, isActive: false, webhookUrl: '' },
    })
    expect(fetch).toHaveBeenCalledWith(
      `/api/webhooks/config?agent_id=${AGENT_ID}`,
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('skips webhook call when webhookUrl is invalid', async () => {
    const fetch = mockFetchOk()
    vi.stubGlobal('fetch', fetch)
    await saveSupplementalSettings(AGENT_ID, PROJECT_ID, {
      webhook: { ...WEBHOOK, webhookUrl: 'not-a-url' },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls dropoff endpoint when dropoff is provided', async () => {
    const fetch = mockFetchOk()
    vi.stubGlobal('fetch', fetch)
    await saveSupplementalSettings(AGENT_ID, PROJECT_ID, { dropoff: DROPOFF })
    expect(fetch).toHaveBeenCalledWith(
      `/api/agents/${AGENT_ID}/dropoff-settings`,
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('calls callback endpoint only when callbackScheduling.enabled is true', async () => {
    const fetch = mockFetchOk()
    vi.stubGlobal('fetch', fetch)
    await saveSupplementalSettings(AGENT_ID, PROJECT_ID, { callbackScheduling: CALLBACK })
    expect(fetch).toHaveBeenCalledWith(
      `/api/agents/${AGENT_ID}/callback-settings`,
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('does not call callback endpoint when callbackScheduling.enabled is false', async () => {
    const fetch = mockFetchOk()
    vi.stubGlobal('fetch', fetch)
    await saveSupplementalSettings(AGENT_ID, PROJECT_ID, {
      callbackScheduling: { ...CALLBACK, enabled: false },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws aggregated error listing which saves failed', async () => {
    vi.stubGlobal('fetch', mockFetchFail())
    await expect(
      saveSupplementalSettings(AGENT_ID, PROJECT_ID, { webhook: WEBHOOK, dropoff: DROPOFF })
    ).rejects.toThrow('Failed to save:')
  })

  it('resolves without calling fetch when no settings provided', async () => {
    const fetch = mockFetchOk()
    vi.stubGlobal('fetch', fetch)
    await saveSupplementalSettings(AGENT_ID, PROJECT_ID, {})
    expect(fetch).not.toHaveBeenCalled()
  })
})
