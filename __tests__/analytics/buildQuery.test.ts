/**
 * The nine ways this engine can draw a clean, plausible, wrong chart —
 * Confluence "Analytics Phase 1 and 2 — Build Spec" §14.1. None of them throw
 * on their own, so nothing but a test catches them.
 *
 * These assert on the SQL text and its bind parameters. The three that need a
 * real database (the numeric-guard coverage number, the CSV export, the
 * project_id backfill) are checked where they live.
 */
import { describe, it, expect, vi } from 'vitest'
import { Spec, type SpecInput } from '@/server/analytics/spec'
import { buildQuery, planDashboardQueries, SpecError, type Ctx } from '@/server/analytics/buildQuery'

const AGENT = '11111111-1111-1111-1111-111111111111'

const ctx: Ctx = {
  projectId: '22222222-2222-2222-2222-222222222222',
  agentIds: [AGENT],
  deniedFields: new Set<string>(),
  tz: 'Asia/Kolkata',
  maxDays: 365,
  now: new Date('2026-09-17T12:00:00Z'),
}

const parse = (s: SpecInput) => Spec.parse(s)

const countByDisposition: SpecInput = {
  spec_version: 1,
  agg: { fn: 'count' },
  dimension: { field: { col: 'transcription_metrics', path: ['final_disposition'] } },
  range: { days: 30 },
}

const oneAppointment = (over: Partial<SpecInput> = {}): SpecInput => ({
  spec_version: 1,
  grain: 'entity',
  dedupe: {
    key: { field: { col: 'metadata', path: ['appointment_id'] } },
    winner: 'best_outcome',
    outcome: { col: 'transcription_metrics', path: ['final_disposition'] },
    ranking: ['triage_complete', 'callback_scheduled', 'patient_unavailable'],
  },
  agg: { fn: 'count' },
  range: { days: 30 },
  ...over,
})

describe('the field path never reaches the SQL text', () => {
  it('passes JSON paths as bind parameters at any depth', () => {
    const { sql, params } = buildQuery(
      parse({
        spec_version: 1,
        agg: { fn: 'count' },
        dimension: { field: { col: 'metadata', path: ['something', 'first', 'deep'] } },
        range: { days: 7 },
      }),
      ctx,
      'aggregate'
    )
    expect(sql).toContain('metadata #>> $')
    expect(sql).not.toContain('something')
    expect(params).toContainEqual(['something', 'first', 'deep'])
  })

  it('keeps a hostile path and a hostile filter value out of the SQL', () => {
    const nasty = `x'); DROP TABLE pype_voice_call_logs; --`
    const { sql, params } = buildQuery(
      parse({
        spec_version: 1,
        agg: { fn: 'count' },
        dimension: { field: { col: 'metadata', path: [nasty] } },
        having: [{ field: { col: 'metadata', path: ['a'] }, op: 'eq', value: nasty }],
        range: { days: 7 },
      }),
      ctx,
      'aggregate'
    )
    expect(sql).not.toContain('DROP TABLE')
    expect(params).toContainEqual([nasty])
    expect(params).toContain(nasty)
  })

  it('refuses a column that is not a real column', () => {
    expect(() =>
      parse({
        spec_version: 1,
        agg: { fn: 'count' },
        dimension: { field: { col: 'pg_shadow', path: ['passwd'] } },
        range: { days: 7 },
      })
    ).toThrow()
  })
})

/* ------------------------------------------------------------------ §14.1 */

describe('1 · filtering before or after picking the winner', () => {
  it('puts pre-dedupe filters in the scan and the user chips after it', () => {
    const cond = { field: { col: 'transcription_metrics', path: ['final_disposition'] }, op: 'eq' as const, value: 'triage_complete' }

    const pre = buildQuery(parse(oneAppointment({ filters: [cond] })), ctx, 'aggregate')
    const post = buildQuery(parse(oneAppointment({ having: [cond] })), ctx, 'aggregate')

    // pre-ranking: inside the scan, so it changes which attempt wins
    expect(pre.sql.indexOf('triage_complete') < 0).toBe(true) // it is a parameter
    expect(scanWhere(pre.sql)).toContain('transcription_metrics #>>')
    expect(pre.sql).not.toMatch(/FROM picked\nWHERE/)

    // post-ranking: applied to the winners
    expect(post.sql).toMatch(/FROM picked\nWHERE/)
    expect(pre.sql).not.toEqual(post.sql)
    expect(post.meta.filtersAfterDedupe).toBe(true)
    expect(pre.meta.filtersAfterDedupe).toBe(false)
  })

  it('refuses a pre-dedupe filter on an array item, which cannot exist yet', () => {
    expect(() =>
      buildQuery(
        parse({
          spec_version: 1,
          grain: 'element',
          element_source: { col: 'transcription_metrics', path: ['members'], encoding: 'json_string' },
          agg: { fn: 'count' },
          filters: [{ field: { col: 'element', path: ['status'] }, op: 'eq', value: 'x' }],
          range: { days: 7 },
        }),
        ctx,
        'aggregate'
      )
    ).toThrow(SpecError)
  })
})

describe('2 · the winner is picked over the whole history, not the chart window', () => {
  it('scans back lookback_days before the range and filters the winners into it', () => {
    const { sql, params, meta } = buildQuery(parse(oneAppointment()), ctx, 'aggregate')
    expect(meta.lookbackDays).toBe(90)

    const scanLo = new Date(`${params[paramIndex(scanWhere(sql), 'call_started_at >=')]}Z`.replace(' ', 'T'))
    const pickedLo = new Date(`${meta.rangeUtc.from}Z`.replace(' ', 'T'))
    const gapDays = Math.round((pickedLo.getTime() - scanLo.getTime()) / 86_400_000)
    expect(gapDays).toBe(90)
    expect(sql).toMatch(/WHERE rn = 1 AND started_at >= \$\d+/)
  })

  it('picks the same winner whether the window is 3 days or 7', () => {
    const three = buildQuery(parse(oneAppointment({ range: { from: '2026-09-15', to: '2026-09-17' } })), ctx, 'aggregate')
    const seven = buildQuery(parse(oneAppointment({ range: { from: '2026-09-11', to: '2026-09-17' } })), ctx, 'aggregate')
    // both rank over 90 days before their own start, so an attempt on day 1
    // is inside the ranking set for both
    expect(three.meta.lookbackDays).toBe(90)
    expect(seven.meta.lookbackDays).toBe(90)
    expect(stripParams(three.sql)).toEqual(stripParams(seven.sql))
  })
})

describe('3 · ties must not be broken at random', () => {
  it('ends the ranking order with the row id', () => {
    const { sql } = buildQuery(parse(oneAppointment()), ctx, 'aggregate')
    expect(sql).toMatch(/ORDER BY array_position\(.*NULLS LAST, s\.created_at DESC, s\.id\)/s)
  })

  it('is byte-identical across twenty builds', () => {
    const built = Array.from({ length: 20 }, () => buildQuery(parse(oneAppointment()), ctx, 'aggregate'))
    for (const b of built) {
      expect(b.sql).toEqual(built[0].sql)
      expect(b.params).toEqual(built[0].params)
    }
  })

  it('sends outcomes missing from the agent order to the back, not the front', () => {
    const { sql } = buildQuery(parse(oneAppointment()), ctx, 'aggregate')
    expect(sql).toContain('NULLS LAST')
  })
})

describe('4 · the number guard must be visible, not silent', () => {
  it('always returns the row count and the usable count beside the number', () => {
    const { sql } = buildQuery(
      parse({
        spec_version: 1,
        agg: { fn: 'avg', field: { col: 'metadata', path: ['bill_amount'] } },
        range: { days: 30 },
      }),
      ctx,
      'aggregate'
    )
    expect(sql).toContain('AS n_rows')
    expect(sql).toContain('count(*) FILTER (WHERE')
    expect(sql).toContain('AS n_nonnull')
    // '₹500' and '1,200' fail the guard and become NULL — which n_nonnull reports
    expect(sql).toMatch(/~ '\^-\?\[0-9\]/)
  })

  it('does not guard a real numeric column', () => {
    const { sql } = buildQuery(
      parse({ spec_version: 1, agg: { fn: 'p95', field: { col: 'avg_latency' } }, range: { days: 30 } }),
      ctx,
      'aggregate'
    )
    expect(sql).toContain('percentile_cont(0.95) WITHIN GROUP (ORDER BY')
    expect(sql).toContain('avg_latency::numeric')
  })
})

describe('5 · true and false are written four ways', () => {
  const rate = (encoding: 'yes_no' | 'one_zero' | 'true_false' | 'y_n'): SpecInput => ({
    spec_version: 1,
    agg: {
      fn: 'rate',
      field: { col: 'transcription_metrics', path: ['is_task_complete'], boolean_encoding: encoding },
    },
    range: { days: 30 },
  })

  it('produces the same query shape for yes/no as for 1/0, differing only in the values', () => {
    const yesNo = buildQuery(parse(rate('yes_no')), ctx, 'aggregate')
    const oneZero = buildQuery(parse(rate('one_zero')), ctx, 'aggregate')
    expect(stripParams(yesNo.sql)).toEqual(stripParams(oneZero.sql))
    expect(yesNo.params).toContainEqual(['yes'])
    expect(oneZero.params).toContainEqual(['1'])
  })

  it('matches case-insensitively and after trimming', () => {
    const { sql } = buildQuery(parse(rate('true_false')), ctx, 'aggregate')
    expect(sql).toContain('lower(btrim(')
  })

  it('counts a rate over rows that hold a recognisable true or false, and says so', () => {
    const { sql } = buildQuery(parse(rate('yes_no')), ctx, 'aggregate')
    // numerator over denominator, never sum() over a count of everything
    expect(sql).toMatch(/count\(\*\) FILTER \(WHERE .*\)\)::numeric \/ NULLIF\(count\(\*\) FILTER/s)
  })

  it('refuses a rate with no stated encoding rather than guessing', () => {
    expect(() =>
      parse({
        spec_version: 1,
        agg: { fn: 'rate', field: { col: 'transcription_metrics', path: ['is_task_complete'] } },
        range: { days: 30 },
      })
    ).toThrow()
  })

  it('lets the denominator be every row when the user asks for that', () => {
    const { sql } = buildQuery(
      parse({
        spec_version: 1,
        agg: {
          fn: 'rate',
          field: { col: 'transcription_metrics', path: ['ok'], boolean_encoding: 'yes_no' },
          denominator: 'all_rows',
        },
        range: { days: 30 },
      }),
      ctx,
      'aggregate'
    )
    expect(sql).toContain('NULLIF(count(*) FILTER (WHERE TRUE), 0)')
  })
})

describe('6 · permissions are enforced here, not in the browser', () => {
  it('scopes every query to the agents this member may read', () => {
    for (const target of ['aggregate', 'drill', 'export'] as const) {
      const { sql, params } = buildQuery(parse(countByDisposition), ctx, target)
      expect(sql).toContain('l.agent_id = ANY($')
      expect(params).toContainEqual([AGENT])
    }
  })

  it('adds the tenant column once that database is backfilled', () => {
    const before = buildQuery(parse(countByDisposition), ctx, 'aggregate')
    expect(before.sql).not.toContain('project_id')

    process.env.ANALYTICS_PROJECT_ID_BACKFILLED = 'true'
    vi.resetModules()
    return import('@/server/analytics/buildQuery').then(({ buildQuery: fresh }) => {
      const after = fresh(parse(countByDisposition), ctx, 'aggregate')
      expect(after.sql).toContain('l.project_id = $')
      expect(after.params).toContain(ctx.projectId)
      // and the agent list is still there — the column is defence in depth,
      // never a replacement for it
      expect(after.sql).toContain('l.agent_id = ANY($')
      delete process.env.ANALYTICS_PROJECT_ID_BACKFILLED
      vi.resetModules()
    })
  })

  it('refuses to build at all with no readable agents', () => {
    expect(() => buildQuery(parse(countByDisposition), { ...ctx, agentIds: [] }, 'aggregate')).toThrow(SpecError)
  })

  it('refuses a field the member may not see, whoever wrote the spec', () => {
    const restricted: Ctx = { ...ctx, deniedFields: new Set(['transcription_metrics.final_disposition']) }
    expect(() => buildQuery(parse(countByDisposition), restricted, 'aggregate')).toThrow(/no permission/)
  })

  it('hides every path underneath a hidden column', () => {
    const restricted: Ctx = { ...ctx, deniedFields: new Set(['metadata']) }
    expect(() =>
      buildQuery(
        parse({ ...countByDisposition, dimension: { field: { col: 'metadata', path: ['usage', 'cost'] } } }),
        restricted,
        'aggregate'
      )
    ).toThrow(/no permission/)
  })

  it('checks fields used only inside a filter too', () => {
    const restricted: Ctx = { ...ctx, deniedFields: new Set(['metadata.total_cost_secret']) }
    expect(() =>
      buildQuery(
        parse({
          ...countByDisposition,
          having: [{ field: { col: 'metadata', path: ['total_cost_secret'] }, op: 'is_not_empty' }],
        }),
        restricted,
        'aggregate'
      )
    ).toThrow(/no permission/)
  })
})

describe('9 · a time range that crosses midnight', () => {
  it('reads 22:00–02:00 as the night shift, not as nothing', () => {
    const { sql } = buildQuery(
      parse({ ...countByDisposition, time_of_day: { from: '22:00', to: '02:00' } }),
      ctx,
      'aggregate'
    )
    expect(sql).toMatch(/::time >= \$\d+::time OR .*::time\s+<\s+\$\d+::time/s)
  })

  it('reads 09:00–17:00 as one span', () => {
    const { sql } = buildQuery(
      parse({ ...countByDisposition, time_of_day: { from: '09:00', to: '17:00' } }),
      ctx,
      'aggregate'
    )
    expect(sql).toContain(' AND ')
    expect(sql).not.toMatch(/::time OR /)
  })

  it('compares in the project time zone, never in UTC', () => {
    const { sql, params } = buildQuery(
      parse({ ...countByDisposition, time_of_day: { from: '09:00', to: '17:00' } }),
      ctx,
      'aggregate'
    )
    expect(sql).toContain(`AT TIME ZONE 'UTC' AT TIME ZONE $`)
    expect(params).toContain('Asia/Kolkata')
  })
})

/* ------------------------------------------------------- the rest of §14.2 */

describe('time zones and ranges', () => {
  it('starts "last 30 days" at local midnight, not UTC midnight', () => {
    const { meta } = buildQuery(parse(countByDisposition), ctx, 'aggregate')
    // 12:00 UTC is 17:30 on 17 Sep in Kolkata, so the window is 19 Aug – 18 Sep
    // local, which is 18:30 the day before in UTC
    expect(meta.rangeUtc.from).toBe('2026-08-18 18:30:00.000')
    expect(meta.rangeUtc.to).toBe('2026-09-17 18:30:00.000')
  })

  it('includes the last day of an explicit range', () => {
    const { meta } = buildQuery(
      parse({ ...countByDisposition, range: { from: '2026-09-01', to: '2026-09-07' } }),
      ctx,
      'aggregate'
    )
    expect(meta.rangeUtc.from).toBe('2026-08-31 18:30:00.000')
    expect(meta.rangeUtc.to).toBe('2026-09-07 18:30:00.000')
  })

  it('refuses a range longer than the cap', () => {
    expect(() => buildQuery(parse({ ...countByDisposition, range: { days: 400 } }), { ...ctx, maxDays: 90 }, 'aggregate')).toThrow(/limit is 90/)
  })

  it('picks the bucket from the length of the range', () => {
    const bucketFor = (days: number) =>
      buildQuery(parse({ ...countByDisposition, dimension: undefined, bucket: 'auto', range: { days } }), ctx, 'aggregate').meta.bucket
    expect(bucketFor(1)).toBe('hour')
    expect(bucketFor(30)).toBe('day')
    expect(bucketFor(90)).toBe('week')
    expect(bucketFor(365)).toBe('month')
  })
})

describe('what the numbers are counted over', () => {
  it('leaves live calls out of completed-call numbers by default', () => {
    const { sql } = buildQuery(parse(countByDisposition), ctx, 'aggregate')
    expect(sql).toContain(`coalesce(l.wcall_event, 'call_ended') = 'call_ended'`)
  })

  it('lets a live-calls chart ask for them', () => {
    const { sql } = buildQuery(parse({ ...countByDisposition, include_live_calls: true }), ctx, 'aggregate')
    expect(sql).not.toContain('wcall_event')
  })

  it('counts every environment until somebody says otherwise', () => {
    // defaulting this to ['dev'] zeroed every chart on every dev-deployed
    // agent, silently — the filter has to be visible to be safe
    const byDefault = buildQuery(parse(countByDisposition), ctx, 'aggregate')
    expect(byDefault.sql).not.toContain('l.environment')

    const excluded = buildQuery(parse({ ...countByDisposition, exclude_environments: ['dev'] }), ctx, 'aggregate')
    expect(excluded.params).toContainEqual(['dev'])
    expect(excluded.sql).toContain('l.environment')
  })

  it('treats all four spellings of empty as missing', () => {
    const { params } = buildQuery(parse(countByDisposition), ctx, 'aggregate')
    expect(params).toContainEqual(['', '-', 'null', 'n/a'])
  })

  it('can show the empty bucket as its own category instead', () => {
    const shown = buildQuery(
      parse({ ...countByDisposition, dimension: { field: { col: 'metadata', path: ['x'] }, include_empty: true } }),
      ctx,
      'aggregate'
    )
    expect(shown.sql).not.toMatch(/END\) IS NOT NULL/)
  })
})

describe('array items are one row each, and only after the winner is picked', () => {
  const members: SpecInput = {
    spec_version: 1,
    grain: 'element',
    element_source: { col: 'transcription_metrics', path: ['members'], encoding: 'json_string' },
    agg: { fn: 'count' },
    dimension: { field: { col: 'element', path: ['finalDisposition'] } },
    range: { days: 30 },
  }

  it('parses JSON stored as text before expanding it', () => {
    const { sql } = buildQuery(parse(members), ctx, 'aggregate')
    expect(sql).toContain('pg_input_is_valid(')
    expect(sql).toContain('jsonb_array_elements(')
  })

  it('makes a broken value expand to nothing rather than fail the query', () => {
    const { sql } = buildQuery(parse(members), ctx, 'aggregate')
    expect(sql).toContain(`ELSE '[]'::jsonb END`)
  })

  it('reads a plain array of values with an empty path', () => {
    const { sql, params } = buildQuery(
      parse({ ...members, dimension: { field: { col: 'element' } } }),
      ctx,
      'aggregate'
    )
    expect(sql).toContain('elem #>> $')
    expect(params).toContainEqual([])
  })

  it('expands after the winner is picked, never before', () => {
    const { sql } = buildQuery(
      parse({ ...members, grain: 'element' }),
      ctx,
      'aggregate'
    )
    expect(sql.indexOf('scanned AS')).toBeLessThan(sql.indexOf('expanded AS'))
  })

  it('refuses an element reference when nothing is being expanded', () => {
    expect(() =>
      parse({
        spec_version: 1,
        agg: { fn: 'count' },
        dimension: { field: { col: 'element', path: ['x'] } },
        range: { days: 30 },
      })
    ).toThrow()
  })
})

describe('one per patient, one per appointment', () => {
  it('keeps a keyless call as its own appointment by default', () => {
    const { sql } = buildQuery(parse(oneAppointment()), ctx, 'aggregate')
    expect(sql).toContain(`COALESCE(`)
    expect(sql).toContain(`'no-key-' || s.call_id`)
  })

  it('can drop keyless calls instead', () => {
    const spec = oneAppointment()
    const { sql } = buildQuery(
      parse({ ...spec, dedupe: { ...spec.dedupe!, key: { field: { col: 'metadata', path: ['appointment_id'] }, fallback: 'none' } } }),
      ctx,
      'aggregate'
    )
    expect(sql).toMatch(/FROM scanned s\n {2}WHERE .* IS NOT NULL/)
  })

  it('never lets one appointment id collide across two agents', () => {
    const { sql } = buildQuery(parse(oneAppointment()), ctx, 'aggregate')
    expect(sql).toContain('PARTITION BY s.agent_id,')
  })

  it('takes the outcome order as a parameter, so reordering it needs no SQL change', () => {
    const { sql, params } = buildQuery(parse(oneAppointment()), ctx, 'aggregate')
    expect(sql).toContain('array_position($')
    expect(params).toContainEqual(['triage_complete', 'callback_scheduled', 'patient_unavailable'])
    expect(sql).not.toContain('CASE WHEN final_disposition')
  })

  it('refuses best_outcome with no order to rank by', () => {
    const spec = oneAppointment()
    expect(() =>
      buildQuery(parse({ ...spec, dedupe: { ...spec.dedupe!, ranking: undefined } }), ctx, 'aggregate')
    ).toThrow(/outcome order/)
  })

  it('refuses dedupe at the wrong grain, either way round', () => {
    expect(() => parse({ ...oneAppointment(), grain: 'interaction' })).toThrow()
    expect(() => parse({ spec_version: 1, grain: 'entity', agg: { fn: 'count' }, range: { days: 30 } })).toThrow()
  })
})

describe('drill-down and export walk the same rows as the chart', () => {
  it('pages by key, never by OFFSET', () => {
    const { sql } = buildQuery(parse(countByDisposition), ctx, 'drill', {
      dimensionValue: 'triage_complete',
      cursor: { startedAt: '2026-09-10 04:00:00', id: '33333333-3333-3333-3333-333333333333' },
    })
    expect(sql).not.toContain('OFFSET')
    expect(sql).toMatch(/\(\w+\.started_at, \w+\.id\) < \(\$\d+::timestamp, \$\d+::uuid\)/)
    expect(sql).toMatch(/ORDER BY \w+\.started_at DESC NULLS LAST, \w+\.id DESC/)
  })

  it('matches the empty bucket rather than dropping it', () => {
    const { sql, params } = buildQuery(
      parse({ ...countByDisposition, dimension: { field: { col: 'metadata', path: ['x'] }, include_empty: true } }),
      ctx,
      'drill',
      { dimensionValue: null }
    )
    expect(sql).toContain('IS NOT DISTINCT FROM $')
    expect(params).toContain(null)
  })

  it('caps how much one page can ask for', () => {
    const { params } = buildQuery(parse(countByDisposition), ctx, 'export', { limit: 1_000_000 })
    expect(params).toContain(5000)
  })
})

describe('the shape of the result', () => {
  it('is a single value when nothing is grouped', () => {
    const { sql } = buildQuery(
      parse({ spec_version: 1, agg: { fn: 'count' }, range: { days: 30 } }),
      ctx,
      'aggregate'
    )
    expect(sql).not.toContain('GROUP BY')
  })

  it('is a time series when a bucket is set', () => {
    const { sql, params } = buildQuery(
      parse({ spec_version: 1, agg: { fn: 'count' }, bucket: 'day', range: { days: 30 } }),
      ctx,
      'aggregate'
    )
    expect(sql).toContain('date_trunc($')
    expect(params).toContain('day')
    expect(sql).toContain('GROUP BY 1')
    expect(sql).toContain('ORDER BY 1')
  })

  it('is a breakdown over time when both are set, and does not cut whole days off', () => {
    const { sql } = buildQuery(parse({ ...countByDisposition, bucket: 'day' }), ctx, 'aggregate')
    expect(sql).toContain('GROUP BY 1, 2')
    // the LIMIT bounds the category count via top_series, not the days — every
    // bucket still gets a row, just folded into a bounded set of series
    expect(sql).toContain('top_series')
    expect(sql).toContain('LIMIT')
  })

  it('limits the categories of a plain breakdown', () => {
    const { sql, params } = buildQuery(parse(countByDisposition), ctx, 'aggregate')
    expect(sql).toContain('ORDER BY value DESC NULLS LAST')
    expect(params).toContain(50)
  })

  it('never carries the big JSON columns through the window function', () => {
    const { sql } = buildQuery(parse(oneAppointment()), ctx, 'aggregate')
    expect(sql).not.toContain('transcript_json')
    expect(sql).not.toContain('telemetry_')
    expect(sql).not.toContain('complete_configuration')
    expect(sql).not.toMatch(/SELECT l\.\*/)
  })
})

/* ------------------------------------------------------------------ helpers */

/** The WHERE block of the first CTE — everything applied during the table scan. */
function scanWhere(sql: string): string {
  return sql.slice(sql.indexOf('FROM pype_voice_call_logs l'), sql.indexOf('\n)'))
}

/** 1-based $n in a fragment → 0-based index into params. */
function paramIndex(fragment: string, after: string): number {
  const m = fragment.slice(fragment.indexOf(after)).match(/\$(\d+)/)
  if (!m) throw new Error(`no parameter after "${after}"`)
  return Number(m[1]) - 1
}

/** Two queries differing only in their bound values compare equal. */
function stripParams(sql: string): string {
  return sql.replace(/\$\d+/g, '$?')
}

describe('which days count', () => {
  it('filters to the chosen weekdays, in the project time zone', () => {
    const { sql, params } = buildQuery(
      parse({ ...countByDisposition, days_of_week: [1, 2, 3, 4, 5] }),
      ctx,
      'aggregate'
    )
    // isodow so Monday is 1 and Sunday is 7
    expect(sql).toContain('EXTRACT(isodow FROM')
    expect(sql).toContain(`AT TIME ZONE 'UTC' AT TIME ZONE $`)
    expect(params).toContainEqual([1, 2, 3, 4, 5])
  })

  it('does not filter at all when every day is chosen', () => {
    const all = buildQuery(parse({ ...countByDisposition, days_of_week: [1, 2, 3, 4, 5, 6, 7] }), ctx, 'aggregate')
    const none = buildQuery(parse({ ...countByDisposition, days_of_week: [] }), ctx, 'aggregate')
    expect(all.sql).not.toContain('isodow')
    expect(none.sql).not.toContain('isodow')
  })
})

describe('every operator compiles to a runnable query', () => {
  const field = { col: 'transcription_metrics' as const, path: ['is_cancellation_transfer'], boolean_encoding: 'one_zero' as const }

  it.each([
    ['is_true', undefined],
    ['is_false', undefined],
    ['is_empty', undefined],
    ['is_not_empty', undefined],
    ['eq', 'x'],
    ['neq', 'x'],
    ['in', ['a', 'b']],
    ['not_in', ['a']],
    ['contains', 'x'],
    ['starts_with', 'x'],
    ['gt', 5],
    ['gte', 5],
    ['lt', 5],
    ['lte', 5],
  ])('binds no parameter it does not use: %s', (op, value) => {
    // `is yes` and the numeric comparisons never read the text form of a field.
    // Building it anyway left an orphan parameter, and Postgres rejects a
    // statement carrying one — every card on the dashboard went amber.
    expect(() =>
      buildQuery(
        parse({ ...countByDisposition, having: [{ field, op: op as never, ...(value !== undefined ? { value } : {}) }] }),
        ctx,
        'aggregate'
      )
    ).not.toThrow()
  })

  it('does the same for a pre-dedupe filter', () => {
    expect(() =>
      buildQuery(parse({ ...countByDisposition, filters: [{ field, op: 'is_true' }] }), ctx, 'aggregate')
    ).not.toThrow()
  })
})

describe('one answer written four ways is one category', () => {
  const byHindi = (caseInsensitive: boolean): SpecInput => ({
    spec_version: 1,
    agg: { fn: 'count' },
    dimension: {
      field: { col: 'transcription_metrics', path: ['is_Conversation_hindi'] },
      case_insensitive: caseInsensitive,
    },
    range: { days: 30 },
  })

  it('folds case in the query, so yes and Yes are one bucket', () => {
    expect(buildQuery(parse(byHindi(true)), ctx, 'aggregate').sql).toContain('lower((CASE WHEN')
  })

  it('leaves the values alone by default — folding a name would be wrong', () => {
    expect(buildQuery(parse(byHindi(false)), ctx, 'aggregate').sql).not.toContain('lower((CASE WHEN')
  })

  it('matches the same bucket when you click through to the calls', () => {
    const chart = buildQuery(parse(byHindi(true)), ctx, 'aggregate')
    const drill = buildQuery(parse(byHindi(true)), ctx, 'drill', { dimensionValue: 'yes' })
    // the folding has to happen in SQL, or the bar and the list below it disagree
    expect(drill.sql).toContain('lower((CASE WHEN')
    expect(chart.sql).toContain('lower((CASE WHEN')
  })
})

describe('charts that read the same rows share one scan', () => {
  const kpi = (over: Partial<SpecInput>): SpecInput => ({
    spec_version: 1, agg: { fn: 'count' }, range: { days: 30 }, ...over,
  })

  it('puts the tiles that differ only in what they add up into one statement', () => {
    const plans = planDashboardQueries(
      [
        { id: 'calls', spec: parse(kpi({})) },
        { id: 'minutes', spec: parse(kpi({ agg: { fn: 'sum', field: { col: 'call_duration_seconds' } } })) },
        { id: 'done', spec: parse(kpi({ having: [{ field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' }] })) },
      ],
      ctx
    )
    expect(plans).toHaveLength(1)
    expect(plans[0].members).toEqual(['calls', 'minutes', 'done'])
    expect(plans[0].sql).toContain('AS value_0')
    expect(plans[0].sql).toContain('AS value_2')
  })

  it('carries the columns a companion needs, not only the first chart’s', () => {
    // "total minutes" measures call_ended_at and the count it shares a scan
    // with does not; without this the statement fails on a missing column
    const plans = planDashboardQueries(
      [
        { id: 'calls', spec: parse(kpi({})) },
        { id: 'minutes', spec: parse(kpi({ agg: { fn: 'sum', field: { col: 'call_duration_seconds' } } })) },
      ],
      ctx
    )
    expect(plans[0].sql).toContain('l.call_ended_at')
  })

  it('keeps a companion’s own filter out of the shared WHERE', () => {
    const plans = planDashboardQueries(
      [
        { id: 'all', spec: parse(kpi({})) },
        { id: 'done', spec: parse(kpi({ having: [{ field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' }] })) },
      ],
      ctx
    )
    // in the aggregate, never in the scan — or "all calls" would be filtered too
    expect(scanWhere(plans[0].sql)).not.toContain('call_ended_reason')
    expect(plans[0].sql).toMatch(/count\(\*\) FILTER \(WHERE .*call_ended_reason/)
  })

  it('separates charts that genuinely read different rows', () => {
    const plans = planDashboardQueries(
      [
        { id: 'a', spec: parse(kpi({})) },
        { id: 'b', spec: parse(kpi({ bucket: 'day' })) },
        { id: 'c', spec: parse(kpi({ range: { days: 7 } })) },
        { id: 'd', spec: parse(kpi({ include_live_calls: true })) },
      ],
      ctx
    )
    expect(plans).toHaveLength(4)
  })

  it('leaves a lone chart exactly as it was', () => {
    const plans = planDashboardQueries([{ id: 'only', spec: parse(countByDisposition) }], ctx)
    expect(plans[0].sql).toEqual(buildQuery(parse(countByDisposition), ctx, 'aggregate').sql)
  })

  it('still orders a shared breakdown, so its LIMIT is not arbitrary', () => {
    const plans = planDashboardQueries(
      [
        { id: 'a', spec: parse(countByDisposition) },
        { id: 'b', spec: parse({ ...countByDisposition, agg: { fn: 'count_distinct', field: { col: 'customer_number' } } }) },
      ],
      ctx
    )
    expect(plans[0].sql).toContain('ORDER BY value_0 DESC NULLS LAST')
    expect(plans[0].sql).toContain('LIMIT')
  })
})

/**
 * `duration_seconds` is a DDL default computed at INSERT, when the call has not
 * ended — so it is NULL on most rows. The drill list showed "—" for the length
 * of calls the chart beside it had just totalled in minutes.
 */
describe('the drill list reports a length the chart would recognise', () => {
  const spec = Spec.parse({ spec_version: 1, agg: { fn: 'count' }, range: { days: 30 } } satisfies SpecInput)

  it('falls back to the same subtraction the charts use', () => {
    const { sql } = buildQuery(spec, ctx, 'drill')
    expect(sql).toContain('coalesce')
    expect(sql).toMatch(/EXTRACT\(epoch FROM \(\w+\.call_ended_at - \w+\.started_at\)\)/)
    expect(sql).toContain('AS duration_seconds')
  })

  it('and so does an export, so the file matches the screen', () => {
    expect(buildQuery(spec, ctx, 'export').sql).toContain('AS duration_seconds')
  })

  it('but an aggregate is untouched — it already measures what it was asked for', () => {
    expect(buildQuery(spec, ctx, 'aggregate').sql).not.toContain('AS duration_seconds')
  })
})

describe('the same phone number written three ways is one person', () => {
  const base: SpecInput = { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 } }

  it('counts unique callers by digits, not by however the number was typed', () => {
    const { sql } = buildQuery(
      parse({ ...base, agg: { fn: 'count_distinct', field: { col: 'customer_number' } } }),
      ctx, 'aggregate'
    )
    // prod holds +917012224839 and 917012224839 for one patient
    expect(sql).toMatch(/count\(DISTINCT .*regexp_replace/s)
    expect(sql).toContain("right(regexp_replace")
  })

  it('leaves a web session id whole — customer_number is not always a phone', () => {
    const { sql } = buildQuery(
      parse({ ...base, agg: { fn: 'count_distinct', field: { col: 'customer_number' } } }),
      ctx, 'aggregate'
    )
    // the guard: only phone-shaped text is reduced to its digits
    expect(sql).toContain("~ '^[+0-9()\\s-]{10,15}$'")
  })

  it('deduplicates one-per-patient on the same normalised key', () => {
    const { sql } = buildQuery(
      parse({
        ...base,
        grain: 'entity',
        dedupe: { key: { field: { col: 'customer_number' }, fallback: 'call_id' }, winner: 'most_recent', lookback_days: 30 },
      }),
      ctx, 'aggregate'
    )
    expect(sql).toMatch(/PARTITION BY .*regexp_replace/s)
  })

  it('does not touch a field that is not a phone number', () => {
    const { sql } = buildQuery(
      parse({ ...base, agg: { fn: 'count_distinct', field: { col: 'call_ended_reason' } } }),
      ctx, 'aggregate'
    )
    expect(sql).not.toContain('regexp_replace')
  })
})
