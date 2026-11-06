import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Guard: call-data tables are reached only through the data plane. A table name
 * outside the adapters means a route is talking to Pype's database directly and
 * would bypass a customer's routing. Do NOT add files to LEGACY; convert them to
 * the data plane instead. Remove an entry when its file no longer names a table
 * (the test fails on stale entries so the list only shrinks).
 */
const TABLES = [
  'pype_voice_call_logs',
  'pype_voice_metrics_logs',
  'pype_voice_session_traces',
  'pype_voice_spans',
  'pype_voice_reprocess_status',
  'pype_voice_dropoff_calls',
  'qa_flag_tickets',
  'pype_voice_dnc_list',
]
const ADAPTERS = 'src/server/data-plane/adapters/'

const LEGACY = new Set([
  'src/app/[projectid]/agents/[agentid]/observability/page.tsx',
  'src/app/[projectid]/agents/[agentid]/studio/page.tsx',
  'src/components/Dashboard.tsx',
  'src/components/FlagRulesDialog.tsx',
  'src/components/calls/DownloadDialog.tsx',
  'src/components/calls/v2/split/CallInspector.tsx',
  'src/components/observabilty/ObservabilityFilters.tsx',
  'src/components/observabilty/ObservabilityStats.tsx',
  'src/components/observabilty/SpanDetailSheet.tsx',
  'src/hooks/useCallLogsColumns.ts',
  'src/hooks/useCallTranscript.ts',
  'src/hooks/useSessionTrace.ts',
  'src/lib/metadataColumnDenylist.ts',
  'src/server/analytics/buildQuery.ts',
  'src/server/analytics/catalog.ts',
  'src/server/analytics/journeys.ts',
  'src/server/pi/callLogsTools.ts',
  'src/utils/callLogsUtils.ts',
])

const root = join(__dirname, '../../..')
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

const offenders = walk(join(root, 'src'))
  .map((p) => relative(root, p).split('\\').join('/'))
  .filter((f) => !f.startsWith(ADAPTERS))
  .filter((f) => TABLES.some((t) => readFileSync(join(root, f), 'utf8').includes(t)))

describe('call-data table guard', () => {
  it('no call-data table name appears outside the adapters, except legacy files', () => {
    expect(offenders.filter((f) => !LEGACY.has(f))).toEqual([])
  })

  it('every legacy entry still names a table (remove it once converted)', () => {
    expect([...LEGACY].filter((f) => !offenders.includes(f))).toEqual([])
  })
})
