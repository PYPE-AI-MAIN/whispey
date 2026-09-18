/**
 * CSV that Excel opens correctly and does not execute — Confluence "Analytics
 * Phase 1 and 2 — Build Spec" §9.4.
 *
 * Exports carry transcribed free text and patient names, so both halves matter:
 * a value beginning `=`, `+`, `-` or `@` is run as a formula by Excel, Sheets
 * and LibreOffice unless it is defused, and Hindi and Kannada are normal in
 * these fields, so the file needs a byte-order mark or Excel renders them as
 * mojibake.
 */

/** Excel treats a cell starting with any of these as a formula. Tab and CR let a value break the row. */
const FORMULA_START = /^[=+\-@\t\r]/

/** Excel needs this to read the file as UTF-8. Written once, at the start of the first page. */
export const UTF8_BOM = '﻿'

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  // a real negative number is not an injection, and prefixing it would turn the
  // column into text
  if (typeof value === 'number' || typeof value === 'boolean') return `"${value}"`
  let text: string
  if (value instanceof Date) {
    text = value.toISOString()
  } else if (typeof value === 'object') {
    text = JSON.stringify(value)
  } else {
    text = String(value)
  }
  const defused = FORMULA_START.test(text) ? `'${text}` : text
  return `"${defused.replaceAll('"', '""')}"`
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',') + '\r\n'
}

export function csvPage(columns: string[], rows: Record<string, unknown>[], withHeader: boolean): string {
  const header = withHeader ? UTF8_BOM + csvRow(columns) : ''
  return header + rows.map((r) => csvRow(columns.map((c) => r[c]))).join('')
}
