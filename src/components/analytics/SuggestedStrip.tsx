/**
 * The SUGGESTED strip — Confluence "Analytics Phase 1 and 2 — Build Spec" §10's
 * canvas mockup, and the rules half of §11.3.
 *
 * The rules that produce these have been in `suggest.ts` since phase 1, with
 * tests, and nothing rendered them. This is that strip: charts worth building
 * for this agent, each one saying why it is worth building.
 *
 * §11.3: "Every suggestion says why — otherwise it is noise." So the reason is
 * not a tooltip. It is the second line of the card, always visible, and it is
 * the field's real coverage rather than a claim.
 */
'use client'
import React, { useMemo, useState } from 'react'
import { BarChart3, Hash, LineChart as LineIcon, Plus, Sparkles, X } from 'lucide-react'
import type { CatalogField, ChartKind, Widget } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'
import { chartSubject, suggestions } from './suggest'

const ICON: Partial<Record<ChartKind, React.ReactNode>> = {
  kpi: <Hash className="h-3.5 w-3.5" />,
  bar: <BarChart3 className="h-3.5 w-3.5" />,
  line: <LineIcon className="h-3.5 w-3.5" />,
}

/** At most this many, or the strip becomes the dashboard. */
const MAX_SHOWN = 4

export function SuggestedStrip({
  fields, widgets, canEdit, onAdd,
}: {
  fields: CatalogField[]
  /** What is already on the canvas — suggesting a chart somebody has is noise. */
  widgets: Widget[]
  canEdit: boolean
  onAdd: (title: string, kind: ChartKind, spec: SpecInput) => void
}) {
  // dismissed for this visit only: a suggestion nobody wants today may be the
  // right chart next month, and nothing here is worth a database row
  const [dismissed, setDismissed] = useState<string[]>([])

  const offers = useMemo(() => {
    const already = new Set(widgets.map((w) => chartSubject(w.spec)))
    return suggestions(fields)
      .filter((s) => !already.has(chartSubject(s.spec)) && !dismissed.includes(s.title))
      .slice(0, MAX_SHOWN)
  }, [fields, widgets, dismissed])

  if (!canEdit || offers.length === 0) return null

  return (
    <div className="mt-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        <Sparkles className="h-3 w-3" /> Suggested
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {offers.map((s) => (
          <div
            key={s.title}
            className="group/suggestion flex items-start gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 px-3 py-2.5 transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-blue-500 dark:hover:bg-blue-950/20"
          >
            <span className="mt-0.5 shrink-0 text-gray-400">{ICON[s.kind] ?? ICON.bar}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200" title={s.title}>
                {s.title}
              </p>
              {/* a suggestion without a reason is noise (§11.3) */}
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-400 dark:text-gray-500">{s.why}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => onAdd(s.title, s.kind, s.spec)}
                aria-label={`Add ${s.title}`}
                className="rounded p-1 text-gray-400 transition hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/50 dark:hover:text-blue-300"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDismissed((d) => [...d, s.title])}
                aria-label={`Dismiss ${s.title}`}
                className="rounded p-1 text-gray-300 opacity-0 transition hover:bg-gray-200 hover:text-gray-600 group-hover/suggestion:opacity-100 focus:opacity-100 dark:text-gray-600 dark:hover:bg-gray-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
