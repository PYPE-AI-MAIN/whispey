import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const {
  mockGetCallerGlobalRole,
  mockMaybeSingle,
  mockEq,
  mockSelect,
  mockUpdate,
  mockUpdateEq,
  mockFrom,
} = vi.hoisted(() => ({
  mockGetCallerGlobalRole: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateEq: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/prod-auth', () => ({ getCallerGlobalRole: mockGetCallerGlobalRole }))
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

import {
  requireSuperAdminOrForbidden,
  resolveColumnAccessForRequest,
  fetchAgentCallLogSettings,
  updateAgentCallLogSettings,
} from '@/lib/agentCallLogSettingsStore'
import type { CallLogSettings, DownloadSettings } from '@/lib/callLogSettings'

// ── Helpers ────────────────────────────────────────────────────────────────
function setupSelectChain(result: { data: unknown; error: unknown }) {
  mockMaybeSingle.mockResolvedValue(result)
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
}

function setupUpdateChain(result: { error: unknown }) {
  mockUpdateEq.mockResolvedValue(result)
  mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
}

describe('agentCallLogSettingsStore', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('requireSuperAdminOrForbidden', () => {
    it('returns null when caller is superadmin', async () => {
      mockGetCallerGlobalRole.mockResolvedValue('superadmin')
      const result = await requireSuperAdminOrForbidden('user_123')
      expect(result).toBeNull()
    })

    it('returns a 403 NextResponse when caller is not superadmin', async () => {
      mockGetCallerGlobalRole.mockResolvedValue('user')
      const result = await requireSuperAdminOrForbidden('user_123')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)
      const body = await result!.json()
      expect(body.error).toBe('Forbidden')
    })

    it('returns a 403 NextResponse when the role lookup yields no role', async () => {
      mockGetCallerGlobalRole.mockResolvedValue(null)
      const result = await requireSuperAdminOrForbidden('missing_user')
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)
    })
  })

  describe('fetchAgentCallLogSettings', () => {
    it('returns parsed current/currentDownload settings when the agent exists', async () => {
      const download_settings: Partial<DownloadSettings> = {
        enabled: false,
        superadmin_only_columns: ['ssn'],
      }
      setupSelectChain({ data: { call_log_settings: { download_settings } }, error: null })

      const result = await fetchAgentCallLogSettings('agent_1')

      expect('errorResponse' in result).toBe(false)
      if ('errorResponse' in result) throw new Error('unexpected error response')
      expect(result.current).toEqual({ download_settings })
      expect(result.currentDownload.enabled).toBe(false)
      expect(result.currentDownload.superadmin_only_columns).toEqual(['ssn'])
      expect(mockFrom).toHaveBeenCalledWith('pype_voice_agents')
      expect(mockEq).toHaveBeenCalledWith('id', 'agent_1')
    })

    it('defaults current to {} when call_log_settings is null', async () => {
      setupSelectChain({ data: { call_log_settings: null }, error: null })

      const result = await fetchAgentCallLogSettings('agent_1')

      expect('errorResponse' in result).toBe(false)
      if ('errorResponse' in result) throw new Error('unexpected error response')
      expect(result.current).toEqual({})
      expect(result.currentDownload.enabled).toBe(true)
    })

    it('returns a 404 error response when the agent does not exist', async () => {
      setupSelectChain({ data: null, error: null })

      const result = await fetchAgentCallLogSettings('missing_agent')

      expect('errorResponse' in result).toBe(true)
      if (!('errorResponse' in result)) throw new Error('expected error response')
      expect(result.errorResponse.status).toBe(404)
      const body = await result.errorResponse.json()
      expect(body.error).toBe('Agent not found')
    })

    it('returns a 404 error response on a supabase error', async () => {
      setupSelectChain({ data: null, error: { message: 'db down' } })

      const result = await fetchAgentCallLogSettings('agent_1')

      expect('errorResponse' in result).toBe(true)
      if (!('errorResponse' in result)) throw new Error('expected error response')
      expect(result.errorResponse.status).toBe(404)
    })
  })

  describe('updateAgentCallLogSettings', () => {
    const current: CallLogSettings = { download_settings: { enabled: true } }
    const nextDownload: DownloadSettings = {
      enabled: false,
      superadmin_only_columns: [],
      user_overrides: {},
    }

    it('returns null on a successful write and merges nextDownload into current', async () => {
      setupUpdateChain({ error: null })

      const result = await updateAgentCallLogSettings('agent_1', current, nextDownload)

      expect(result).toBeNull()
      expect(mockFrom).toHaveBeenCalledWith('pype_voice_agents')
      expect(mockUpdate).toHaveBeenCalledWith({
        call_log_settings: { ...current, download_settings: nextDownload },
      })
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'agent_1')
    })

    it('returns a 500 NextResponse when the supabase write fails', async () => {
      setupUpdateChain({ error: { message: 'write failed' } })

      const result = await updateAgentCallLogSettings('agent_1', current, nextDownload)

      expect(result).not.toBeNull()
      expect(result!.status).toBe(500)
      const body = await result!.json()
      expect(body.error).toBe('write failed')
    })
  })

  describe('resolveColumnAccessForRequest', () => {
    it('resolves isSuperAdmin true and empty disallowedColumns for a superadmin', async () => {
      mockGetCallerGlobalRole.mockResolvedValue('superadmin')

      const result = await resolveColumnAccessForRequest({
        userId: 'user_1',
        userEmail: 'admin@example.com',
        callLogSettings: { download_settings: { superadmin_only_columns: ['ssn'] } },
        isDownload: false,
      })

      expect(result.isSuperAdmin).toBe(true)
      expect(result.userEmail).toBe('admin@example.com')
      expect(result.disallowedColumns.size).toBe(0)
      expect(mockGetCallerGlobalRole).toHaveBeenCalledWith('user_1')
    })

    it('resolves isSuperAdmin false and includes superadmin_only_columns for a regular user', async () => {
      mockGetCallerGlobalRole.mockResolvedValue('user')

      const result = await resolveColumnAccessForRequest({
        userId: 'user_2',
        userEmail: 'user@example.com',
        callLogSettings: { download_settings: { superadmin_only_columns: ['ssn'] } },
        isDownload: false,
      })

      expect(result.isSuperAdmin).toBe(false)
      expect(result.disallowedColumns.has('ssn')).toBe(true)
    })

    it('passes isDownload through so hidden_download_columns are only added when true', async () => {
      mockGetCallerGlobalRole.mockResolvedValue('user')
      const callLogSettings: CallLogSettings = {
        download_settings: {
          superadmin_only_columns: [],
          user_overrides: {
            'user@example.com': {
              hidden_view_columns: ['view_only_col'],
              hidden_download_columns: ['download_only_col'],
              download_disabled: false,
            },
          },
        },
      }

      const viewResult = await resolveColumnAccessForRequest({
        userId: 'user_3',
        userEmail: 'user@example.com',
        callLogSettings,
        isDownload: false,
      })
      const downloadResult = await resolveColumnAccessForRequest({
        userId: 'user_3',
        userEmail: 'user@example.com',
        callLogSettings,
        isDownload: true,
      })

      expect(viewResult.disallowedColumns.has('download_only_col')).toBe(false)
      expect(downloadResult.disallowedColumns.has('download_only_col')).toBe(true)
    })

    it('handles a null userEmail without throwing', async () => {
      mockGetCallerGlobalRole.mockResolvedValue('user')

      const result = await resolveColumnAccessForRequest({
        userId: 'user_4',
        userEmail: null,
        callLogSettings: null,
        isDownload: false,
      })

      expect(result.isSuperAdmin).toBe(false)
      expect(result.userEmail).toBeNull()
    })
  })
})
