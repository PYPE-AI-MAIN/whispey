import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DNC_FIELD_DESCRIPTION,
  DNC_FIELD_KEY,
  dncCheckerChange,
  dncCheckerEnabledError,
  splitDncField,
  withDncField,
} from '@/config/dncChecker'

const mine = [{ key: 'city', description: 'Which city?' }]

describe('DNC checker config', () => {
  it('splits the DNC field out of the saved fields', () => {
    const dnc = { key: DNC_FIELD_KEY, description: 'custom' }
    expect(splitDncField([...mine, dnc])).toEqual({ dncField: dnc, otherFields: mine })
    expect(splitDncField(mine)).toEqual({ dncField: null, otherFields: mine })
  })

  it('adds the DNC field only while the checker is on', () => {
    expect(withDncField(mine, { enabled: false, description: 'x' })).toEqual(mine)
    expect(withDncField(mine, { enabled: true, description: '  Only "band karo".  ' })).toEqual([
      ...mine,
      { key: DNC_FIELD_KEY, description: 'Only "band karo".' },
    ])
  })

  it('falls back to the default rules when the description is emptied', () => {
    expect(withDncField([], { enabled: true, description: '   ' })).toEqual([
      { key: DNC_FIELD_KEY, description: DEFAULT_DNC_FIELD_DESCRIPTION },
    ])
  })

  it('validates the switch and sends it only when it changed', () => {
    expect(dncCheckerEnabledError(true)).toBeNull()
    expect(dncCheckerEnabledError('yes')).toMatch(/true or false/)
    expect(dncCheckerChange(true, true)).toEqual({})
    expect(dncCheckerChange(undefined, false)).toEqual({})
    expect(dncCheckerChange(false, true)).toEqual({ dnc_checker_enabled: true })
  })
})
