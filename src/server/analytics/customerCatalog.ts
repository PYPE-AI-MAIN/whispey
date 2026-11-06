/**
 * The field catalog of a customer-held agent, worked out from a sample read through
 * the data plane. Same fields, types and coverage as catalog.ts scans in SQL, but
 * nothing is stored: the sample values and value lists are the customer's data and
 * must not be written to Pype's pype_analytics_fields. A short in-memory cache only.
 */
import { DEFAULT_SENTINELS, EXPRESSION_SOURCES, JSON_COLS } from './spec'
import { BUILTIN, MAX_DEPTH, SAMPLE_DAYS, SAMPLE_ROWS, builtinFieldRow, jsonFieldRow, STALE_AFTER_MS, type FieldStats } from './catalog'
import type { DataPlane, Row } from '@/server/data-plane'

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const type = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v)
const text = (v: unknown): string | null => (v === null || v === undefined ? null : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** The per-path statistics scanColumn computes in SQL, depth 2. */
export function statsFromRows(rows: Row[], col: string): FieldStats[] {
  const docs = rows.map((r) => r[col]).filter((d) => d !== null && d !== undefined)
  const sentinels = new Set<string>(DEFAULT_SENTINELS.map((s) => s.toLowerCase()))
  const byPath = new Map<string, { path: string[]; values: unknown[] }>()
  const add = (path: string[], v: unknown) => {
    const key = JSON.stringify(path)
    const e = byPath.get(key) ?? { path, values: [] }
    e.values.push(v)
    byPath.set(key, e)
  }
  for (const doc of docs) {
    if (!isObj(doc)) continue
    for (const [k, v] of Object.entries(doc)) {
      add([k], v)
      if (MAX_DEPTH >= 2 && isObj(v)) for (const [k2, v2] of Object.entries(v)) add([k, k2], v2)
    }
  }
  return [...byPath.values()]
    .map(({ path, values }) => {
      const count = (t: string) => values.filter((v) => type(v) === t).length
      const texts = values.map(text).filter((t): t is string => t !== null)
      const left = (t: string) => t.slice(0, 120)
      return {
        path,
        rows_with_key: values.length,
        rows_sampled: docs.length,
        n_object: count('object'),
        n_array: count('array'),
        n_number: count('number'),
        n_boolean: count('boolean'),
        n_string: count('string'),
        n_null: count('null'),
        n_sentinel: texts.filter((t) => sentinels.has(t.trim().toLowerCase())).length,
        distinct_values: new Set(texts.map(left)).size,
        sample_values: [...new Set(values.filter((v) => type(v) !== 'object' && type(v) !== 'array').map(text).filter((t): t is string => t !== null).map(left))].sort().slice(0, 60),
      }
    })
    .sort((a, b) => b.rows_with_key - a.rows_with_key)
    .slice(0, 300)
}

/** The built-in columns' coverage and value lists from the same sample. */
function builtins(rows: Row[]) {
  const total = rows.length
  return BUILTIN.map((b) => {
    const src = EXPRESSION_SOURCES[b.col]?.[0] ?? b.col
    const filled = rows.filter((r) => r[src] !== null && r[src] !== undefined).length
    let values: string[] | null = null
    if (b.value_type === 'enum') values = [...new Set(rows.slice(0, 5000).map((r) => r[b.col]).filter((v) => v !== null && v !== undefined && v !== '').map(String))]
    const usable = values && values.length <= 30 ? values.slice().sort((a, c) => a.localeCompare(c)) : null
    return {
      ...b,
      path: [] as string[],
      enum_values: usable,
      value_type: b.value_type === 'enum' && !usable ? ('text' as const) : b.value_type,
      coverage_pct: total > 0 ? Math.round((filled / total) * 1000) / 10 : 0,
      cardinality_est: values?.length ?? 0,
      is_identity_candidate: b.col === 'customer_number',
    }
  })
}

const COLUMNS = [...new Set([...BUILTIN.flatMap((b) => EXPRESSION_SOURCES[b.col] ?? [b.col]), 'call_started_at', 'id', ...JSON_COLS])].join(',')
const cache = new Map<string, { at: number; rows: Record<string, unknown>[] }>()

export async function customerFieldRows(plane: DataPlane, agentId: string, projectId: string, opts: { force?: boolean; now?: () => number } = {}): Promise<Record<string, unknown>[]> {
  const now = (opts.now ?? Date.now)()
  const key = `${projectId}:${agentId}`
  const hit = cache.get(key)
  if (hit && !opts.force && now - hit.at < STALE_AFTER_MS) return hit.rows
  const sample = await plane.callData.sampleCallRows({
    agentId,
    from: new Date(now - SAMPLE_DAYS * 86_400_000).toISOString().replace('T', ' ').replace('Z', ''),
    limit: SAMPLE_ROWS,
    columns: COLUMNS,
  })
  const stamp = new Date(now).toISOString()
  const out: Record<string, unknown>[] = builtins(sample).map((b) => builtinFieldRow(b as never, agentId, projectId, stamp, undefined))
  for (const col of JSON_COLS) for (const stats of statsFromRows(sample, col)) out.push(jsonFieldRow(stats, col, agentId, projectId, stamp, undefined))
  out.sort((a, b) => Number(b.coverage_pct) - Number(a.coverage_pct))
  cache.set(key, { at: now, rows: out })
  return out
}
