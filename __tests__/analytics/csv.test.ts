import { describe, it, expect } from 'vitest'
import { csvCell, csvRow, csvPage, UTF8_BOM } from '@/server/analytics/csv'

describe('an export cannot run as a formula', () => {
  it('defuses every character Excel treats as the start of one', () => {
    for (const evil of ['=1+1', '+1', '-1+1', '@SUM(A1)', '=cmd|\'/c calc\'!A1']) {
      expect(csvCell(evil)).toBe(`"'${evil}"`)
    }
  })

  it('defuses a patient name that happens to start with one', () => {
    expect(csvCell('=Sharma')).toBe(`"'=Sharma"`)
  })

  it('leaves a real negative number alone, which is not an injection', () => {
    expect(csvCell(-1)).toBe('"-1"')
    expect(csvCell(-12.5)).toBe('"-12.5"')
  })

  it('stops a value breaking out of its row', () => {
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('a\nb')).toBe('"a\nb"')
    expect(csvCell('\tinjected')).toBe(`"'\tinjected"`)
  })
})

describe('an export opens correctly', () => {
  it('starts the file with a byte-order mark so Excel reads Devanagari', () => {
    const page = csvPage(['name'], [{ name: 'डॉ. शर्मा' }], true)
    expect(page.startsWith(UTF8_BOM)).toBe(true)
    expect(page).toContain('डॉ. शर्मा')
  })

  it('writes the mark once, not on every page', () => {
    expect(csvPage(['name'], [{ name: 'b' }], false).includes(UTF8_BOM)).toBe(false)
  })

  it('writes an empty cell for a missing value rather than the word undefined', () => {
    expect(csvPage(['a', 'b'], [{ a: 1 }], false)).toBe('"1",""\r\n')
  })

  it('ends rows the way Excel expects', () => {
    expect(csvRow(['a', 'b'])).toBe('"a","b"\r\n')
  })
})
