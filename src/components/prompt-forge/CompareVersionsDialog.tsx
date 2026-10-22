'use client'

// Compare two Prompt Forge snapshots — saved versions or the working draft —
// side by side: the prompt, the greeting and the settings, like Agent Config
// history does for the live agent.
import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeftRight, Cpu, FileText, Loader2, MessageSquareText, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PromptDiffViewer } from '@/components/shared/TextDiffViewer'

/** What a version (or the draft) holds — the columns a Prompt Forge version saves. */
export interface ForgeSnapshot {
  system_prompt?: string | null
  first_message_mode?: string | null
  first_message?: string | null
  model?: string | null
  provider?: string | null
  temperature?: number | null
  variables?: Array<{ name: string; value: string }> | null
  tools?: Array<{ name: string; mock?: { enabled?: boolean } | null }> | null
}

export interface ForgeVersionInfo { version: number; created_at: string; created_by_email: string | null }

/** A version number, or 'draft' for the working draft. */
export type CompareSide = number | 'draft'

const greetingText = (s: ForgeSnapshot) =>
  [`mode: ${s.first_message_mode ?? 'assistant_waits_for_user'}`, s.first_message ?? ''].join('\n')

/** The settings that matter for a reply, as stable text to diff. */
export function settingsText(s: ForgeSnapshot): string {
  return JSON.stringify(
    {
      model: s.model ?? null,
      provider: s.provider ?? null,
      temperature: s.temperature ?? null,
      variables: (s.variables ?? []).map((v) => ({ name: v.name, value: v.value })),
      tools: (s.tools ?? []).map((t) => (t.mock?.enabled ? `${t.name} (mocked)` : t.name)),
    },
    null,
    2,
  )
}

function sideLabel(side: CompareSide, versions: ForgeVersionInfo[]): string {
  if (side === 'draft') return 'Working draft'
  const v = versions.find((x) => x.version === side)
  return v ? `v${v.version} · ${format(new Date(v.created_at), 'd MMM, h:mm a')}` : `v${side}`
}

function Section({ icon: Icon, title, changed, children }: Readonly<{ icon: typeof FileText; title: string; changed: boolean; children: React.ReactNode }>) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {!changed && <span className="ml-1 text-[10px] text-muted-foreground/60">unchanged</span>}
        <div className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  )
}

function SidePicker({ value, onChange, versions, label }: Readonly<{ value: CompareSide; onChange: (v: CompareSide) => void; versions: ForgeVersionInfo[]; label: string }>) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(v === 'draft' ? 'draft' : Number(v))}>
      <SelectTrigger aria-label={label} size="sm" className="h-8 w-56 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="draft" className="text-xs">Working draft</SelectItem>
        {versions.map((v) => (
          <SelectItem key={v.version} value={String(v.version)} className="text-xs">
            {sideLabel(v.version, versions)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CompareVersionsDialog({ open, onClose, sessionId, versions, draft, initialLeft, initialRight }: Readonly<{
  open: boolean
  onClose: () => void
  sessionId: string
  /** Saved versions, newest first. */
  versions: ForgeVersionInfo[]
  /** What's on screen now. */
  draft: ForgeSnapshot
  initialLeft: CompareSide
  initialRight: CompareSide
}>) {
  const [left, setLeft] = useState<CompareSide>(initialLeft)
  const [right, setRight] = useState<CompareSide>(initialRight)
  const [loaded, setLoaded] = useState<Record<number, ForgeSnapshot>>({})
  const [error, setError] = useState<string | null>(null)

  // each open starts from the pair it was opened for
  useEffect(() => {
    if (!open) return
    setLeft(initialLeft)
    setRight(initialRight)
  }, [open, initialLeft, initialRight])

  // fetch the saved versions being compared, once each
  useEffect(() => {
    if (!open) return
    const needed = [left, right].filter((s): s is number => s !== 'draft' && !loaded[s])
    if (needed.length === 0) return
    let cancelled = false
    Promise.all(
      needed.map((n) =>
        fetch(`/api/prompt-forge/sessions/${sessionId}/versions/${n}`).then(async (r) => {
          if (!r.ok) throw new Error(`Couldn't load v${n}`)
          return [n, (await r.json()) as ForgeSnapshot] as const
        }),
      ),
    )
      .then((pairs) => {
        if (!cancelled) setLoaded((prev) => ({ ...prev, ...Object.fromEntries(pairs) }))
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [open, left, right, loaded, sessionId])

  const snap = (side: CompareSide): ForgeSnapshot | null => (side === 'draft' ? draft : loaded[side] ?? null)
  const a = snap(left)
  const b = snap(right)

  const body = () => {
    if (error) return <p className="py-10 text-center text-xs text-destructive">{error}</p>
    if (!a || !b) {
      return (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )
    }
    const promptChanged = (a.system_prompt ?? '') !== (b.system_prompt ?? '')
    const greetingChanged = greetingText(a) !== greetingText(b)
    const settingsChanged = settingsText(a) !== settingsText(b)
    return (
      <div className="space-y-6">
        <Section icon={FileText} title="System prompt" changed={promptChanged}>
          <PromptDiffViewer oldText={a.system_prompt ?? ''} newText={b.system_prompt ?? ''} emptyMessage="The prompt is the same in both" />
        </Section>
        <Section icon={MessageSquareText} title="Greeting" changed={greetingChanged}>
          <PromptDiffViewer oldText={greetingText(a)} newText={greetingText(b)} emptyMessage="The greeting is the same in both" />
        </Section>
        <Section icon={Cpu} title="Settings" changed={settingsChanged}>
          <PromptDiffViewer oldText={settingsText(a)} newText={settingsText(b)} emptyMessage="Model, variables and tools are the same in both" />
        </Section>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <div className="flex flex-col" style={{ height: '78vh', minHeight: 480 }}>
          <div className="shrink-0 border-b bg-muted/20 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                <DialogTitle className="text-sm font-semibold leading-none">Compare</DialogTitle>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SidePicker label="Compare from" value={left} onChange={setLeft} versions={versions} />
              <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              <SidePicker label="Compare to" value={right} onChange={setRight} versions={versions} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{body()}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
