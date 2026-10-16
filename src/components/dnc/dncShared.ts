// Shared types and helpers for the DNC (Do Not Call) page.

export type DncScope = 'global' | 'project' | 'agent'

export interface DncEntry {
  id: string
  phone_e164: string
  phone_raw: string | null
  scope: DncScope
  project_id: string | null
  agent_id: string | null
  call_log_id: string | null
  reason: string | null
  source: 'manual' | 'csv' | 'api' | 'auto'
  added_by: string
  created_at: string
  project_name: string | null
  agent_name: string | null
}

export interface ProjectOption {
  id: string
  name: string
}

export interface AgentOption {
  id: string
  name: string
  dnc_checker_enabled: boolean
}

export const COUNTRIES = [
  { code: 'IN', name: 'India', prefix: '+91', dial: '91', flag: '🇮🇳', placeholder: '98765 43210' },
  { code: 'US', name: 'United States', prefix: '+1', dial: '1', flag: '🇺🇸', placeholder: '(555) 123-4567' },
]

/**
 * Normalize a number to E.164 using the selected country as the default region.
 * Mirrors the server normalizer (src/lib/dnc.ts) so what we preview matches what
 * gets stored. "Bare" = a national number with no country code; only those get
 * the dial code prepended. Numbers that already carry "+" or the country code
 * are left correct instead of being double-prefixed.
 */
export function applyPrefix(raw: string, dialCode: string): string {
  const hadPlus = raw.trim().startsWith('+')
  let digits = raw.replaceAll(/\D/g, '')
  if (!digits) return ''
  if (hadPlus) return digits.length >= 8 ? `+${digits}` : ''
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
    return digits.length >= 8 ? `+${digits}` : ''
  }
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '')
  if (digits.startsWith(dialCode) && digits.length > 10) return `+${digits}`
  if (digits.length === 10) return `+${dialCode}${digits}`
  return digits.length >= 8 ? `+${digits}` : ''
}

/** Several numbers typed at once: one per line, or separated by commas or semicolons. */
export function parseTypedNumbers(text: string, dialCode: string): string[] {
  const seen = new Set<string>()
  for (const part of text.split(/[\n,;]+/)) {
    const e164 = applyPrefix(part, dialCode)
    if (e164) seen.add(e164)
  }
  return [...seen]
}

/** Find the CSV header named "phone" (case-insensitive). */
export function findPhoneHeader(fields: string[] | undefined): string | undefined {
  return (fields ?? []).find((h) => h.trim().toLowerCase() === 'phone')
}

/** Normalize + dedupe the phone column of parsed CSV rows. */
export function extractCsvPhones(rows: Record<string, string>[], phoneKey: string, dial: string): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const e164 = applyPrefix(String(row[phoneKey] ?? ''), dial)
    if (e164) seen.add(e164)
  }
  return [...seen]
}

/** "+919876543210" → "+91 98765 43210"; other countries stay as stored. */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164)
  if (m) return `+91 ${m[1]} ${m[2]}`
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164)
  if (us) return `+1 ${us[1]} ${us[2]} ${us[3]}`
  return e164
}

/** The call that got an auto-added number onto the list, in its full trace view. */
export function callTraceHref(entry: Pick<DncEntry, 'project_id' | 'agent_id' | 'call_log_id'>): string | null {
  if (!entry.project_id || !entry.agent_id || !entry.call_log_id) return null
  return `/${entry.project_id}/agents/${entry.agent_id}/observability?session_id=${encodeURIComponent(entry.call_log_id)}`
}

/** The caller's words, from an auto entry's reason ('Caller said: "…"'). */
export function callerQuote(reason: string | null): string | null {
  const m = /^Caller said: "([\s\S]*)"$/.exec(reason ?? '')
  return m ? m[1] : null
}

export const SOURCE_LABEL: Record<DncEntry['source'], string> = {
  auto: 'DNC checker',
  manual: 'Manual',
  csv: 'CSV',
  api: 'API',
}
