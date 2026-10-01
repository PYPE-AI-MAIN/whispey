'use client'

/**
 * Turning QA on for an agent, and the handful of numbers it judges against.
 *
 * Saved through PATCH /api/agents/[id] like every other agent setting, so it
 * inherits the permission model rather than inventing one — the same gate that
 * guards metrics.
 *
 * The thresholds matter more than they look. The duration-versus-disposition
 * rules are the cheapest real signal QA has, and they do nothing at all unless
 * the disposition values below match what this agent's field extractor
 * actually writes.
 */
import { useEffect, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { QA_DEFAULTS, QA_LIMITS, type QaConfig } from '@/lib/qaConfigValidation'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  agentId: string
  initial: QaConfig | null
  /** Keys this agent's field extractor declares — the only honest source for these. */
  knownDispositions?: string[]
  onSaved: () => void
}

/** A small list-of-strings editor; dispositions are short and few. */
function TagList({
  label, hint, values, onChange, suggestions = [],
}: Readonly<{
  label: string; hint: string; values: string[]
  onChange: (v: string[]) => void; suggestions?: string[]
}>) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const v = raw.trim().toLowerCase()
    if (!v || values.includes(v)) return
    onChange([...values, v])
    setDraft('')
  }

  const unused = suggestions.filter((s) => !values.includes(s.toLowerCase()))

  return (
    <div>
      <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</Label>
      <p className="mb-1.5 mt-0.5 text-[11px] text-gray-400">{hint}</p>

      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
              <X className="h-3 w-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
            </button>
          </span>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft) } }}
          placeholder="type a value and press Enter"
          className="h-8 text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => add(draft)} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {unused.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-gray-400">seen on this agent:</span>
          {unused.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-500 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NumberField({
  name, value, onChange, suffix,
}: Readonly<{ name: keyof typeof QA_LIMITS; value: number | undefined; onChange: (v: number) => void; suffix: string }>) {
  const { min, max, label } = QA_LIMITS[name]
  return (
    <div>
      <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 text-xs"
        />
        <span className="w-16 flex-none text-[11px] text-gray-400">{suffix}</span>
      </div>
    </div>
  )
}

export default function QaSettingsDialog({
  open, onOpenChange, agentId, initial, knownDispositions = [], onSaved,
}: Readonly<Props>) {
  const [cfg, setCfg] = useState<QaConfig>(initial ?? QA_DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setCfg(initial ?? QA_DEFAULTS)
      setError(null)
    }
  }, [open, initial])

  const set = <K extends keyof QaConfig>(key: K, value: QaConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ qa_config: cfg }),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => ({})))?.error || 'Could not save these settings')
        return
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] sm:max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-none border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <DialogTitle>QA settings</DialogTitle>
          <DialogDescription>
            What gets checked each night, and the limits it judges against.
          </DialogDescription>
        </DialogHeader>

        {/* the only scrolling region — header and footer stay put */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Check this agent every night</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Runs at 2am. Nothing is sent unless there is something worth saying.
              </p>
            </div>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => set('enabled', v)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField name="sample_size" value={cfg.sample_size} onChange={(v) => set('sample_size', v)} suffix="calls" />
            <NumberField name="normal_call_seconds" value={cfg.normal_call_seconds} onChange={(v) => set('normal_call_seconds', v)} suffix="seconds" />
          </div>
          <p className="-mt-3 text-[11px] text-gray-400">
            Half the sample is calls already flagged, half is random. A day with fewer calls than this is checked completely.
            Anything over twice the normal length is treated as a possible loop.
          </p>

          <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Dispositions</p>
            <div className="space-y-4">
              <TagList
                label="Every allowed value"
                hint="Anything this agent records outside this list is flagged as a wrong or misspelt disposition. Leave empty to skip that check."
                values={cfg.disposition_values ?? []}
                onChange={(v) => set('disposition_values', v)}
                suggestions={knownDispositions}
              />
              <TagList
                label="Which of those mean success"
                hint="A call saved as one of these, but shorter than the minimum below, is flagged — there was no time for it to have happened."
                values={cfg.success_dispositions ?? []}
                onChange={(v) => set('success_dispositions', v)}
                suggestions={cfg.disposition_values ?? []}
              />
              <TagList
                label="Which mean nobody answered"
                hint="A call saved as one of these that nonetheless ran a while is flagged — something happened on it."
                values={cfg.unanswered_dispositions ?? []}
                onChange={(v) => set('unanswered_dispositions', v)}
                suggestions={cfg.disposition_values ?? []}
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Limits</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField name="success_in_seconds" value={cfg.success_in_seconds} onChange={(v) => set('success_in_seconds', v)} suffix="seconds" />
              <NumberField name="unanswered_over_seconds" value={cfg.unanswered_over_seconds} onChange={(v) => set('unanswered_over_seconds', v)} suffix="seconds" />
              <NumberField name="min_call_seconds" value={cfg.min_call_seconds} onChange={(v) => set('min_call_seconds', v)} suffix="seconds" />
              <NumberField name="max_utterance_words" value={cfg.max_utterance_words} onChange={(v) => set('max_utterance_words', v)} suffix="words" />
              <NumberField name="latency_ms" value={cfg.latency_ms} onChange={(v) => set('latency_ms', v)} suffix="ms" />
              <NumberField name="silence_ms" value={cfg.silence_ms} onChange={(v) => set('silence_ms', v)} suffix="ms" />
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              Latency and silence are only checked on agents that record per-turn timings. Where they do not, those checks
              are skipped rather than guessed at.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-none border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
