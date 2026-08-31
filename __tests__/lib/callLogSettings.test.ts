import { describe, it, expect } from 'vitest'
import {
  normalizeDownloadSettings,
  isAgentDownloadDisabledForUser,
  getDisallowedColumns,
  filterSelectColumns,
  stripDisallowedColumns,
  DEFAULT_DOWNLOAD_SETTINGS,
} from '@/lib/callLogSettings'

// Shared factory for the `user_overrides` entry shape reused across several
// describe blocks below — keeps individual tests focused on the field(s)
// they actually vary instead of repeating the whole object literal.
const makeOverride = (overrides: Partial<{
  hidden_view_columns: string[]
  hidden_download_columns: string[]
  download_disabled: boolean
}> = {}) => ({
  hidden_view_columns: [],
  hidden_download_columns: [],
  download_disabled: false,
  ...overrides,
})

describe('callLogSettings', () => {
  describe('normalizeDownloadSettings', () => {
    it('returns defaults for null/undefined input', () => {
      expect(normalizeDownloadSettings(null)).toEqual(DEFAULT_DOWNLOAD_SETTINGS)
      expect(normalizeDownloadSettings(undefined)).toEqual(DEFAULT_DOWNLOAD_SETTINGS)
    })

    it('defaults enabled to true when missing', () => {
      expect(normalizeDownloadSettings({}).enabled).toBe(true)
    })

    it('respects an explicit enabled: false', () => {
      expect(normalizeDownloadSettings({ enabled: false }).enabled).toBe(false)
    })

    it('defaults superadmin_only_columns to [] when missing or malformed', () => {
      expect(normalizeDownloadSettings({}).superadmin_only_columns).toEqual([])
      expect(normalizeDownloadSettings({ superadmin_only_columns: 'not-an-array' as unknown as string[] }).superadmin_only_columns).toEqual([])
    })

    it('preserves a valid superadmin_only_columns array', () => {
      expect(normalizeDownloadSettings({ superadmin_only_columns: ['recording_url'] }).superadmin_only_columns).toEqual(['recording_url'])
    })

    it('lowercases and trims user_overrides email keys', () => {
      const result = normalizeDownloadSettings({
        user_overrides: {
          '  Foo@Example.COM  ': { hidden_view_columns: ['a'], hidden_download_columns: [], download_disabled: false },
        },
      })
      expect(Object.keys(result.user_overrides)).toEqual(['foo@example.com'])
      expect(result.user_overrides['foo@example.com'].hidden_view_columns).toEqual(['a'])
    })

    it('normalizes a malformed/old-shape override entry to safe defaults', () => {
      const result = normalizeDownloadSettings({
        user_overrides: {
          'a@b.com': { hidden_columns: ['legacy'] } as unknown as Record<string, unknown>,
        },
      })
      expect(result.user_overrides['a@b.com']).toEqual({
        hidden_view_columns: [],
        hidden_download_columns: [],
        download_disabled: false,
      })
    })

    it('ignores a non-object user_overrides value', () => {
      expect(normalizeDownloadSettings({ user_overrides: 'nope' as unknown as Record<string, never> }).user_overrides).toEqual({})
    })

    it('coerces download_disabled to a strict boolean', () => {
      const result = normalizeDownloadSettings({
        user_overrides: { 'a@b.com': { download_disabled: 'true' as unknown as boolean } },
      })
      expect(result.user_overrides['a@b.com'].download_disabled).toBe(false)
    })
  })

  describe('isAgentDownloadDisabledForUser', () => {
    it('is never disabled for a superadmin, even with a matching override', () => {
      const settings = {
        download_settings: { user_overrides: { 'a@b.com': makeOverride({ download_disabled: true }) } },
      }
      expect(isAgentDownloadDisabledForUser(settings, true, 'a@b.com')).toBe(false)
    })

    it('is false when userEmail is missing', () => {
      expect(isAgentDownloadDisabledForUser({ download_settings: {} }, false, null)).toBe(false)
    })

    it('is false when settings are null/undefined', () => {
      expect(isAgentDownloadDisabledForUser(null, false, 'a@b.com')).toBe(false)
      expect(isAgentDownloadDisabledForUser(undefined, false, 'a@b.com')).toBe(false)
    })

    it('is true when the override sets download_disabled for a non-superadmin', () => {
      const settings = {
        download_settings: { user_overrides: { 'a@b.com': makeOverride({ download_disabled: true }) } },
      }
      expect(isAgentDownloadDisabledForUser(settings, false, 'a@b.com')).toBe(true)
    })

    it('is false when no override exists for the user', () => {
      const settings = { download_settings: { user_overrides: {} } }
      expect(isAgentDownloadDisabledForUser(settings, false, 'a@b.com')).toBe(false)
    })

    it('looks up the override case-insensitively', () => {
      const settings = {
        download_settings: { user_overrides: { 'a@b.com': makeOverride({ download_disabled: true }) } },
      }
      expect(isAgentDownloadDisabledForUser(settings, false, 'A@B.COM')).toBe(true)
    })
  })

  describe('getDisallowedColumns', () => {
    const settings = {
      download_settings: {
        superadmin_only_columns: ['recording_url'],
        user_overrides: {
          'a@b.com': makeOverride({
            hidden_view_columns: ['caller_number'],
            hidden_download_columns: ['transcript'],
          }),
        },
      },
    }

    it('returns an empty set for superadmins regardless of settings', () => {
      expect(getDisallowedColumns(settings, true, 'a@b.com', true)).toEqual(new Set())
      expect(getDisallowedColumns(settings, true, null)).toEqual(new Set())
    })

    it('always includes superadmin_only_columns for non-superadmins', () => {
      expect(getDisallowedColumns(settings, false, null)).toEqual(new Set(['recording_url']))
    })

    it('includes hidden_view_columns from the matching user override', () => {
      expect(getDisallowedColumns(settings, false, 'a@b.com')).toEqual(new Set(['recording_url', 'caller_number']))
    })

    it('only includes hidden_download_columns when forDownload is true', () => {
      expect(getDisallowedColumns(settings, false, 'a@b.com', false)).toEqual(new Set(['recording_url', 'caller_number']))
      expect(getDisallowedColumns(settings, false, 'a@b.com', true)).toEqual(
        new Set(['recording_url', 'caller_number', 'transcript'])
      )
    })

    it('looks up the user override case-insensitively', () => {
      expect(getDisallowedColumns(settings, false, 'A@B.COM', true)).toEqual(
        new Set(['recording_url', 'caller_number', 'transcript'])
      )
    })

    it('handles a user with no matching override', () => {
      expect(getDisallowedColumns(settings, false, 'nobody@else.com', true)).toEqual(new Set(['recording_url']))
    })

    it('handles null/undefined settings', () => {
      expect(getDisallowedColumns(null, false, 'a@b.com')).toEqual(new Set())
      expect(getDisallowedColumns(undefined, false, null)).toEqual(new Set())
    })
  })

  describe('filterSelectColumns', () => {
    it('passes through unchanged when disallowed set is empty', () => {
      expect(filterSelectColumns('a,b,c', new Set())).toBe('a,b,c')
      expect(filterSelectColumns(['a', 'b'], new Set())).toEqual(['a', 'b'])
    })

    it('filters an array input', () => {
      expect(filterSelectColumns(['a', 'b', 'c'], new Set(['b']))).toEqual(['a', 'c'])
    })

    it('filters a comma-separated string input, trimming whitespace', () => {
      expect(filterSelectColumns('a, b , c', new Set(['b']))).toBe('a,c')
    })

    it('leaves "*" untouched even with a non-empty disallowed set', () => {
      expect(filterSelectColumns('*', new Set(['a']))).toBe('*')
    })

    it('returns non-string/non-array input unchanged', () => {
      expect(filterSelectColumns(null, new Set(['a']))).toBe(null)
      expect(filterSelectColumns(undefined, new Set(['a']))).toBe(undefined)
    })
  })

  describe('stripDisallowedColumns', () => {
    it('returns rows unchanged when disallowed set is empty', () => {
      const rows = [{ a: 1, b: 2 }]
      expect(stripDisallowedColumns(rows, new Set())).toEqual(rows)
    })

    it('removes disallowed keys from every row without mutating the input', () => {
      const rows = [{ a: 1, b: 2 }, { a: 3, b: 4 }]
      const result = stripDisallowedColumns(rows, new Set(['b']))
      expect(result).toEqual([{ a: 1 }, { a: 3 }])
      expect(rows[0]).toEqual({ a: 1, b: 2 })
    })
  })
})
