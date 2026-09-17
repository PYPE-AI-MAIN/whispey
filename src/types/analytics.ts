/** Shapes shared between the analytics API routes and the canvas. */
import type { SpecInput } from '@/server/analytics/spec'

export type ChartKind = 'kpi' | 'bar' | 'line' | 'table' | 'pie'
export type WidgetWidth = 'quarter' | 'half' | 'full'

export type Widget = {
  id: string
  dashboard_id: string
  title: string
  kind: ChartKind
  spec: SpecInput
  layout: { width: WidgetWidth }
  position: number
  live: boolean
  is_seeded: boolean
}

export type Dashboard = {
  id: string
  name: string
  version: number
  defaults: Record<string, unknown>
}

/** One row of a chart result. `bucket` is a time bucket, `series` a category; either can be absent. */
export type ResultRow = {
  bucket?: string | null
  series?: string | null
  value: string | number | null
  n_rows: string | number
  n_nonnull: string | number
}

export type WidgetResult = {
  widget_id: string
  status: 'ok' | 'error' | 'timeout' | 'skipped'
  data?: ResultRow[]
  meta?: { bucket: string; filtersAfterDedupe: boolean; lookbackDays: number }
  error?: string
}

export type CatalogField = {
  id: string
  col: string
  path: string[]
  label: string
  value_type: 'boolean' | 'number' | 'enum' | 'text' | 'json' | null
  boolean_encoding: 'one_zero' | 'true_false' | 'yes_no' | 'y_n' | null
  encoding: 'native' | 'json_string' | null
  json_shape: 'scalar' | 'object' | 'array' | null
  enum_values: string[] | null
  coverage_pct: number | null
  cardinality_est: number | null
  is_identity_candidate: boolean
  is_dimension: boolean
  type_confirmed: boolean
}
