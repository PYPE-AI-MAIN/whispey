/**
 * What a new dashboard opens with — Confluence "Analytics Phase 1 and 2 — Build
 * Spec" §10.10. Nobody should ever land on a blank page.
 *
 * These are the seven tiles and two charts the Overview page shows today,
 * rewritten as ordinary saved chart objects. They stop being special-cased code
 * and become rows anyone can edit, duplicate, filter or export like any other
 * chart.
 *
 * They are marked `is_seeded`. Editing one makes a copy for that client, so
 * anyone who never edits keeps getting our improvements.
 */
import type { SpecInput } from './spec'

export type StarterChart = {
  title: string
  kind: 'kpi' | 'bar' | 'line' | 'table'
  layout: { width: 'quarter' | 'half' | 'full' }
  spec: SpecInput
}

const SECONDS_TO_MINUTES = 1 / 60

export const STARTER_CHARTS: StarterChart[] = [
  {
    title: 'Total calls',
    kind: 'kpi',
    layout: { width: 'quarter' },
    spec: { spec_version: 1, agg: { fn: 'count' }, range: { days: 7 }, display: { round: 0 } },
  },
  {
    title: 'Total minutes',
    kind: 'kpi',
    layout: { width: 'quarter' },
    spec: {
      spec_version: 1,
      agg: { fn: 'sum', field: { col: 'duration_seconds' } },
      range: { days: 7 },
      // full precision in the query; the rounding happens once, on screen
      display: { round: 0, unit: 'm', scale: SECONDS_TO_MINUTES },
    },
  },
  {
    title: 'Billing minutes',
    kind: 'kpi',
    layout: { width: 'quarter' },
    spec: {
      spec_version: 1,
      agg: { fn: 'sum', field: { col: 'billing_duration_seconds' } },
      range: { days: 7 },
      display: { round: 0, unit: 'm', scale: SECONDS_TO_MINUTES },
    },
  },
  {
    title: 'Total cost',
    kind: 'kpi',
    layout: { width: 'quarter' },
    spec: {
      spec_version: 1,
      agg: { fn: 'sum', field: { col: 'total_cost' } },
      range: { days: 7 },
      display: { round: 2, unit: '₹', direction: 'lower_is_better' },
    },
  },
  {
    title: 'Response time',
    kind: 'kpi',
    layout: { width: 'quarter' },
    spec: {
      spec_version: 1,
      agg: { fn: 'avg', field: { col: 'avg_latency' } },
      range: { days: 7 },
      display: { round: 2, unit: 's', direction: 'lower_is_better' },
    },
  },
  {
    title: 'Completed calls',
    kind: 'kpi',
    layout: { width: 'quarter' },
    spec: {
      spec_version: 1,
      agg: { fn: 'count' },
      having: [{ field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' }],
      range: { days: 7 },
      display: { round: 0, direction: 'higher_is_better' },
    },
  },
  {
    title: 'Incomplete calls',
    kind: 'kpi',
    layout: { width: 'quarter' },
    spec: {
      spec_version: 1,
      agg: { fn: 'count' },
      having: [{ field: { col: 'call_ended_reason' }, op: 'not_in', value: ['completed'] }],
      range: { days: 7 },
      display: { round: 0, direction: 'lower_is_better' },
    },
  },
  {
    // a call_started row with no matching call_ended is a call happening now
    title: 'Live calls',
    kind: 'kpi',
    layout: { width: 'quarter' },
    spec: {
      spec_version: 1,
      agg: { fn: 'count' },
      include_live_calls: true,
      having: [{ field: { col: 'wcall_event' }, op: 'eq', value: 'call_started' }],
      range: { days: 1 },
      display: { round: 0, empty_text: 'No calls running' },
    },
  },
  {
    title: 'Daily call volume',
    kind: 'line',
    layout: { width: 'half' },
    spec: { spec_version: 1, agg: { fn: 'count' }, bucket: 'day', range: { days: 30 }, display: { round: 0 } },
  },
  {
    title: 'Usage minutes',
    kind: 'bar',
    layout: { width: 'half' },
    spec: {
      spec_version: 1,
      agg: { fn: 'sum', field: { col: 'duration_seconds' } },
      bucket: 'day',
      range: { days: 30 },
      display: { round: 0, unit: 'm', scale: SECONDS_TO_MINUTES },
    },
  },
  {
    title: 'Why calls ended',
    kind: 'bar',
    layout: { width: 'half' },
    spec: {
      spec_version: 1,
      agg: { fn: 'count' },
      dimension: { field: { col: 'call_ended_reason' }, limit: 12 },
      range: { days: 30 },
      display: { round: 0 },
    },
  },
  {
    title: 'Latency spread',
    kind: 'line',
    layout: { width: 'half' },
    spec: {
      spec_version: 1,
      agg: { fn: 'p95', field: { col: 'avg_latency' } },
      bucket: 'day',
      range: { days: 30 },
      display: { round: 2, unit: 's', direction: 'lower_is_better' },
    },
  },
]
