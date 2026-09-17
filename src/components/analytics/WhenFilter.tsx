/**
 * Which days and which hours — Confluence "Analytics Phase 1 and 2 — Build
 * Spec" §10.3 ("date and time-of-day live here").
 *
 * The date range is the Period control in the page header. This is the other
 * half: the hours of the day and the days of the week, in the project's own
 * zone. A hospital's night shift and its Tuesday morning are different
 * services, and averaging them together hides both.
 *
 * Like every other filter above the canvas, it shows as a chip you can see and
 * remove — an hours window that is on but invisible makes every number on the
 * page wrong.
 */
'use client'
import React from 'react'
import { Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type TimeOfDay = { from: string; to: string } | null

const PRESETS: { label: string; window: TimeOfDay }[] = [
  { label: 'Any time', window: null },
  { label: 'Morning · 6am–12pm', window: { from: '06:00', to: '12:00' } },
  { label: 'Afternoon · 12pm–6pm', window: { from: '12:00', to: '18:00' } },
  { label: 'Evening · 6pm–10pm', window: { from: '18:00', to: '22:00' } },
  // crosses midnight on purpose: this is the case that returns nothing at all
  // if the range is read as a simple between
  { label: 'Night shift · 10pm–2am', window: { from: '22:00', to: '02:00' } },
]

const DAYS = [
  { n: 1, label: 'M' }, { n: 2, label: 'T' }, { n: 3, label: 'W' }, { n: 4, label: 'T' },
  { n: 5, label: 'F' }, { n: 6, label: 'S' }, { n: 7, label: 'S' },
]
const WEEKDAYS = [1, 2, 3, 4, 5]

export function WhenFilter({
  timeOfDay, days, onChange,
}: {
  timeOfDay: TimeOfDay
  /** 1 = Monday to 7 = Sunday. Empty or all seven means every day. */
  days: number[]
  onChange: (next: { timeOfDay: TimeOfDay; days: number[] }) => void
}) {
  const allDays = days.length === 0 || days.length === 7
  const active = Boolean(timeOfDay) || !allDays
  const preset = PRESETS.find((p) => p.window?.from === timeOfDay?.from && p.window?.to === timeOfDay?.to)

  const toggleDay = (n: number) => {
    const current = allDays ? [1, 2, 3, 4, 5, 6, 7] : days
    const next = current.includes(n) ? current.filter((d) => d !== n) : [...current, n].sort()
    // zero days would return nothing at all; treat it as "every day" instead
    onChange({ timeOfDay, days: next.length === 0 || next.length === 7 ? [] : next })
  }

  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 px-2 text-xs', active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500')}
          >
            <Clock className="mr-1 h-3 w-3" />
            {active ? describe(timeOfDay, days, preset?.label) : 'When'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-3">
          <p className="mb-1.5 text-[11px] font-medium text-gray-500">Time of day</p>
          <div className="mb-3 space-y-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => onChange({ timeOfDay: p.window, days })}
                className={cn(
                  'w-full rounded-md px-2 py-1.5 text-left text-xs transition',
                  (p.window?.from ?? null) === (timeOfDay?.from ?? null)
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center gap-2">
            <input
              type="time"
              value={timeOfDay?.from ?? ''}
              onChange={(e) => onChange({ timeOfDay: { from: e.target.value, to: timeOfDay?.to ?? '23:59' }, days })}
              className="h-7 w-full rounded-md border border-gray-200 bg-transparent px-1.5 text-xs dark:border-gray-800"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="time"
              value={timeOfDay?.to ?? ''}
              onChange={(e) => onChange({ timeOfDay: { from: timeOfDay?.from ?? '00:00', to: e.target.value }, days })}
              className="h-7 w-full rounded-md border border-gray-200 bg-transparent px-1.5 text-xs dark:border-gray-800"
            />
          </div>

          <p className="mb-1.5 text-[11px] font-medium text-gray-500">Days</p>
          <div className="flex gap-1">
            {DAYS.map((d) => {
              const on = allDays || days.includes(d.n)
              return (
                <button
                  key={d.n}
                  onClick={() => toggleDay(d.n)}
                  aria-pressed={on}
                  className={cn(
                    'h-7 w-7 rounded-md border text-xs transition',
                    on
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-gray-200 text-gray-400 dark:border-gray-800'
                  )}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => onChange({ timeOfDay, days: WEEKDAYS })}
            className="mt-1.5 text-[11px] text-gray-500 underline-offset-2 hover:underline"
          >
            Weekdays only
          </button>
        </PopoverContent>
      </Popover>

      {active && (
        <button
          onClick={() => onChange({ timeOfDay: null, days: [] })}
          aria-label="Clear the time filter"
          className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function describe(timeOfDay: TimeOfDay, days: number[], presetLabel: string | undefined): string {
  const parts: string[] = []
  if (presetLabel && presetLabel !== 'Any time') parts.push(presetLabel.split(' · ')[0])
  else if (timeOfDay) parts.push(`${timeOfDay.from}–${timeOfDay.to}`)
  if (days.length && days.length < 7) {
    parts.push(days.join(',') === '1,2,3,4,5' ? 'weekdays' : days.map((d) => DAYS[d - 1].label).join(''))
  }
  return parts.join(' · ') || 'When'
}
