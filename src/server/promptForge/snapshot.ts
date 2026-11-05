// Comparing Prompt Forge snapshots, so Save only adds a version when something
// actually changed. Key order and missing-vs-null don't count as changes.

/** JSON with object keys sorted, and undefined read as null. */
export function canonicalJson(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (v === undefined) return null
    if (Array.isArray(v)) return v.map(normalize)
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort((a, b) => a.localeCompare(b))
          .map((k) => [k, normalize((v as Record<string, unknown>)[k])]),
      )
    }
    return v
  }
  return JSON.stringify(normalize(value))
}

/** Whether two snapshots hold the same values for these fields. */
export function sameSnapshot(a: Record<string, unknown>, b: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((f) => canonicalJson(a[f]) === canonicalJson(b[f]))
}
