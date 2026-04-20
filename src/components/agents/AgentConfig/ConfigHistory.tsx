'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { diffLines } from 'diff'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Loader2, ChevronLeft, ChevronRight, Clock, User, Copy, Check,
  FileText, Cpu, Volume2, Mic, MessageSquare, Variable, ArrowLeftRight, X,
} from 'lucide-react'
import { useConfigHistory, ConfigHistoryEntryDetail } from '@/hooks/useConfigHistory'
import { formatDistanceToNow, format } from 'date-fns'
import { buildFormValuesFromAgent } from '@/hooks/useAgentConfig'
import { serializeConfig, prettyPrintConfig } from '@/utils/agentConfigSerializer'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  agentId: string
}

type Screen =
  | { mode: 'list' }
  | { mode: 'config'; detail: ConfigHistoryEntryDetail; loading: false }
  | { mode: 'config'; loading: true }

interface ComparePickMode {
  entryId: string
  versionNumber: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Config extraction — handles both LiveKit and Pipecat snapshot shapes
// ─────────────────────────────────────────────────────────────────────────────

function isPipecatSnapshot(snapshot: any): boolean {
  return snapshot?.platform === 'pipecat'
}

function getAssistant(snapshot: any) {
  // LiveKit format: { agent: { assistant: [{ ... }] } }
  if (snapshot?.agent?.assistant?.[0]) return snapshot.agent.assistant[0]
  // Pipecat format: { platform: 'pipecat', agent: { prompt, llm_model, ... } }
  if (isPipecatSnapshot(snapshot)) return snapshot.agent ?? {}
  // Legacy fallback
  return snapshot?.assistant?.[0] ?? {}
}

function buildPortableCopyTextFromSnapshot(configSnapshot: any): string {
  const assistant = getAssistant(configSnapshot)
  const formikValues = buildFormValuesFromAgent(assistant)

  const ttsConfig = {
    provider: formikValues.ttsProvider || '',
    model: formikValues.ttsModel || '',
    config: formikValues.ttsVoiceConfig || {},
  }

  const sttConfig = {
    provider: formikValues.sttProvider || '',
    model: formikValues.sttModel || '',
    config: formikValues.sttConfig || {},
  }

  const azureConfig = {
    endpoint: assistant?.llm?.azure_endpoint || '',
    apiVersion: assistant?.llm?.api_version || '',
  }

  const serialized = serializeConfig(formikValues, ttsConfig, sttConfig, azureConfig)
  return prettyPrintConfig(serialized)
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy helper
// ─────────────────────────────────────────────────────────────────────────────

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff utilities
// ─────────────────────────────────────────────────────────────────────────────

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'separator'
  content: string
  lineOld?: number
  lineNew?: number
  separatorCount?: number
}

function buildDiffLines(oldText: string, newText: string, context = 4): DiffLine[] {
  const changes = diffLines(oldText || '', newText || '')

  const expanded: DiffLine[] = []
  let lineOld = 1, lineNew = 1

  for (const change of changes) {
    const raw = change.value
    const lines = raw.endsWith('\n') ? raw.slice(0, -1).split('\n') : raw.split('\n')

    for (const line of lines) {
      if (change.removed) {
        expanded.push({ type: 'removed', content: line, lineOld })
        lineOld++
      } else if (change.added) {
        expanded.push({ type: 'added', content: line, lineNew })
        lineNew++
      } else {
        expanded.push({ type: 'unchanged', content: line, lineOld, lineNew })
        lineOld++
        lineNew++
      }
    }
  }

  const show = new Set<number>()
  expanded.forEach((l, i) => {
    if (l.type !== 'unchanged') {
      for (let k = Math.max(0, i - context); k <= Math.min(expanded.length - 1, i + context); k++) {
        show.add(k)
      }
    }
  })

  if (show.size === 0) return []

  const result: DiffLine[] = []
  let skipped = 0

  expanded.forEach((line, i) => {
    if (show.has(i)) {
      if (skipped > 0) {
        result.push({ type: 'separator', content: '', separatorCount: skipped })
        skipped = 0
      }
      result.push(line)
    } else {
      skipped++
    }
  })
  if (skipped > 0) result.push({ type: 'separator', content: '', separatorCount: skipped })

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Config diff helper
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_DIFF_SKIP = new Set([
  'prompt', 'name',
  'whispey_api_key', 'whispey_agent_id', 'token_hash', 'whispey_key_id', 'token',
])

function configForDiff(assistant: any): string {
  if (!assistant || typeof assistant !== 'object') return '{}'
  const filtered: Record<string, any> = {}
  for (const k of Object.keys(assistant).sort()) {
    if (!CONFIG_DIFF_SKIP.has(k)) filtered[k] = assistant[k]
  }
  return JSON.stringify(filtered, null, 2)
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff viewer
// ─────────────────────────────────────────────────────────────────────────────

function PromptDiffViewer({
  oldText,
  newText,
  emptyMessage = 'No changes',
}: {
  oldText: string
  newText: string
  emptyMessage?: string
}) {
  const lines = buildDiffLines(oldText, newText)

  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center py-5 rounded-lg border border-dashed text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden font-mono text-xs leading-5">
      {lines.map((line, i) => {
        if (line.type === 'separator') {
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1 bg-muted/50 border-y text-muted-foreground select-none text-xs"
            >
              <span>···</span>
              <span>{line.separatorCount} unchanged line{line.separatorCount !== 1 ? 's' : ''}</span>
            </div>
          )
        }

        const isAdded   = line.type === 'added'
        const isRemoved = line.type === 'removed'

        const rowBg = isAdded
          ? 'bg-green-500/10'
          : isRemoved
            ? 'bg-red-500/10'
            : ''

        const gutterBg = isAdded
          ? 'bg-green-500/15'
          : isRemoved
            ? 'bg-red-500/15'
            : 'bg-muted/30'

        return (
          <div key={i} className={`flex min-h-[20px] ${rowBg}`}>
            <span className={`w-10 text-right pr-1.5 py-px select-none text-[11px] shrink-0 border-r border-border/50 text-muted-foreground/60 ${gutterBg}`}>
              {isAdded ? '' : (line.lineOld ?? '')}
            </span>
            <span className={`w-10 text-right pr-1.5 py-px select-none text-[11px] shrink-0 border-r border-border/50 text-muted-foreground/60 ${gutterBg}`}>
              {isRemoved ? '' : (line.lineNew ?? '')}
            </span>
            <span className={`w-6 text-center py-px select-none shrink-0 font-semibold text-xs ${
              isAdded   ? 'text-green-500' :
              isRemoved ? 'text-red-500'   :
              'text-transparent'
            }`}>
              {isAdded ? '+' : isRemoved ? '−' : ' '}
            </span>
            <span className="flex-1 pl-1 pr-3 py-px whitespace-pre-wrap break-all text-foreground">
              {line.content || '\u00A0'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff Dialog
// ─────────────────────────────────────────────────────────────────────────────

function DiffDialog({
  open,
  onClose,
  entryA,
  entryB,
}: {
  open: boolean
  onClose: () => void
  entryA: ConfigHistoryEntryDetail
  entryB: ConfigHistoryEntryDetail
}) {
  const [older, newer] = entryA.version_number <= entryB.version_number
    ? [entryA, entryB] : [entryB, entryA]

  const assistantOld = getAssistant(older.config_snapshot)
  const assistantNew = getAssistant(newer.config_snapshot)

  const configOldStr = configForDiff(assistantOld)
  const configNewStr = configForDiff(assistantNew)
  const promptChanged = (assistantOld.prompt ?? '') !== (assistantNew.prompt ?? '')
  const configChanged = configOldStr !== configNewStr

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-4xl max-w-[calc(100%-2rem)] p-0 gap-0 overflow-hidden"
      >
        <div className="flex flex-col" style={{ height: '72vh', minHeight: '480px' }}>

          <div className="shrink-0 px-5 py-3 border-b bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <ArrowLeftRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <DialogTitle className="text-sm font-semibold leading-none">
                  Diff
                </DialogTitle>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1 min-w-0">
                  <span className="font-medium text-foreground">#{older.version_number}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="truncate">{format(new Date(older.created_at), 'MMM d, h:mm a')}</span>
                  <ArrowLeftRight className="w-3 h-3 shrink-0 text-muted-foreground/40" />
                  <span className="font-medium text-primary">#{newer.version_number}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="truncate">{format(new Date(newer.created_at), 'MMM d, h:mm a')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {promptChanged && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-amber-500/15 text-amber-600 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                    <FileText className="w-2.5 h-2.5" />
                    Prompt
                  </span>
                )}
                {configChanged && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-blue-500/15 text-blue-600 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">
                    <Cpu className="w-2.5 h-2.5" />
                    Settings
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            <section>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">System Prompt</h3>
                {!promptChanged && (
                  <span className="text-[10px] text-muted-foreground/60 ml-1">unchanged</span>
                )}
                <div className="flex-1 h-px bg-border" />
              </div>
              <PromptDiffViewer
                oldText={assistantOld.prompt ?? ''}
                newText={assistantNew.prompt ?? ''}
                emptyMessage="Prompt is identical in both versions"
              />
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">Settings</h3>
                {!configChanged && (
                  <span className="text-[10px] text-muted-foreground/60 ml-1">unchanged</span>
                )}
                <div className="flex-1 h-px bg-border" />
              </div>
              <PromptDiffViewer
                oldText={configOldStr}
                newText={configNewStr}
                emptyMessage="All settings are identical in both versions"
              />
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Config detail view
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/40 border-b">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">{children}</div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === '') return null
  const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wide font-medium text-muted-foreground">{label}</span>
      <span className="text-xs font-mono break-all">{display}</span>
    </div>
  )
}

function ConfigDetailView({
  entry,
  onBack,
  onStartCompare,
}: {
  entry: ConfigHistoryEntryDetail
  onBack: () => void
  onStartCompare: (entry: ConfigHistoryEntryDetail) => void
}) {
  const snapshot = entry.config_snapshot
  const assistant = getAssistant(snapshot)
  const isPipecat = isPipecatSnapshot(snapshot)
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const text = buildPortableCopyTextFromSnapshot(entry.config_snapshot)
      const ok = await copyText(text)
      if (ok) { setIsCopied(true); setTimeout(() => setIsCopied(false), 2000) }
    } catch (err) {
      console.error('Failed to copy portable config:', err)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b flex items-center gap-2">
        <button
          onClick={onBack}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold">Version #{entry.version_number}</p>
            {isPipecat && (
              <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded font-medium">
                Pipecat
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{format(new Date(entry.created_at), 'MMM d, yyyy · h:mm a')}</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={handleCopy}>
          {isCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {isCopied ? 'Copied!' : 'Copy'}
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => onStartCompare(entry)}>
          <ArrowLeftRight className="w-3 h-3" />
          Compare
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* System Prompt — same for both platforms */}
        {assistant.prompt && (
          <SectionCard title="System Prompt" icon={FileText}>
            <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word leading-relaxed max-h-56 overflow-y-auto">
              {assistant.prompt}
            </pre>
          </SectionCard>
        )}

        {/* ── Pipecat-specific fields ── */}
        {isPipecat && (
          <>
            {assistant.llm_model && (
              <SectionCard title="LLM Settings" icon={Cpu}>
                <FieldRow label="Provider" value={assistant.llm_provider} />
                <FieldRow label="Model"    value={assistant.llm_model} />
              </SectionCard>
            )}
            {assistant.tts_model && (
              <SectionCard title="Voice (TTS)" icon={Volume2}>
                <FieldRow label="Model"    value={assistant.tts_model} />
                <FieldRow label="Voice ID" value={assistant.tts_voice_id} />
              </SectionCard>
            )}
            {assistant.stt_model && (
              <SectionCard title="Speech-to-Text" icon={Mic}>
                <FieldRow label="Model"    value={assistant.stt_model} />
                <FieldRow label="Language" value={assistant.stt_language} />
              </SectionCard>
            )}
            {assistant.opening_message && (
              <SectionCard title="Opening Message" icon={MessageSquare}>
                <FieldRow label="Message" value={assistant.opening_message} />
              </SectionCard>
            )}
          </>
        )}

        {/* ── LiveKit-specific fields ── */}
        {!isPipecat && (
          <>
            {assistant.llm && (
              <SectionCard title="LLM Settings" icon={Cpu}>
                <FieldRow label="Provider"    value={assistant.llm?.provider} />
                <FieldRow label="Model"       value={assistant.llm?.model} />
                <FieldRow label="Temperature" value={assistant.llm?.temperature} />
                <FieldRow label="Max Tokens"  value={assistant.llm?.maxTokens ?? assistant.llm?.max_tokens} />
              </SectionCard>
            )}
            {assistant.tts && (
              <SectionCard title="Voice (TTS)" icon={Volume2}>
                <FieldRow label="Provider" value={assistant.tts?.provider} />
                <FieldRow label="Voice"    value={assistant.tts?.voice ?? assistant.tts?.voiceId ?? assistant.tts?.voice_id} />
                <FieldRow label="Model"    value={assistant.tts?.model} />
              </SectionCard>
            )}
            {assistant.stt && (
              <SectionCard title="Speech-to-Text" icon={Mic}>
                <FieldRow label="Provider" value={assistant.stt?.provider} />
                <FieldRow label="Model"    value={assistant.stt?.model} />
                <FieldRow label="Language" value={assistant.stt?.language} />
              </SectionCard>
            )}
            {(assistant.first_message != null || assistant.firstMessage != null) && (
              <SectionCard title="First Message" icon={MessageSquare}>
                <FieldRow label="Message" value={assistant.first_message ?? assistant.firstMessage} />
                <FieldRow label="Mode"    value={assistant.first_message_mode ?? assistant.firstMessageMode} />
              </SectionCard>
            )}
            {Array.isArray(assistant.variables) && assistant.variables.length > 0 && (
              <SectionCard title="Variables" icon={Variable}>
                <div className="space-y-1">
                  {assistant.variables.map((v: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border rounded px-2 py-1.5">
                      <span className="text-xs font-mono text-primary">{'{{'}{v.name}{'}}'}</span>
                      {v.description && <span className="text-[10px] text-muted-foreground truncate ml-2">{v.description}</span>}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// History entry row
// ─────────────────────────────────────────────────────────────────────────────

function HistoryEntryRow({
  entry,
  isCompareBaseline,
  isComparePickMode,
  copiedId,
  onView,
  onCopy,
  onSelectForCompare,
  onCancelBaseline,
}: {
  entry: { id: string; version_number: number; created_by_email: string | null; created_at: string }
  isCompareBaseline: boolean
  isComparePickMode: boolean
  copiedId: string | null
  onView: (id: string) => void
  onCopy: (id: string) => void
  onSelectForCompare: (id: string) => void
  onCancelBaseline: () => void
}) {
  const date = new Date(entry.created_at)
  const isCopied = copiedId === entry.id

  const handleRowClick = () => {
    if (isComparePickMode && !isCompareBaseline) {
      onSelectForCompare(entry.id)
    } else if (!isComparePickMode && !isCompareBaseline) {
      onView(entry.id)
    }
  }

  return (
    <div
      onClick={handleRowClick}
      className={`rounded-lg border transition-all ${
        isCompareBaseline
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : isComparePickMode
            ? 'border-border/60 hover:border-primary/40 hover:bg-muted/20 cursor-pointer'
            : 'border-border hover:bg-muted/30 cursor-pointer'
      }`}
    >
      {isCompareBaseline && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-primary/10 border-b border-primary/20 rounded-t-lg">
          <div className="flex items-center gap-1.5">
            <Check className="w-3 h-3 text-primary" />
            <span className="text-xs font-semibold text-primary">Selected as baseline</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onCancelBaseline() }}
            className="text-xs text-primary/70 hover:text-primary transition-colors underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center gap-2.5 px-3 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Version #{entry.version_number}</span>
            <span className="text-xs text-muted-foreground">{formatDistanceToNow(date, { addSuffix: true })}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{format(date, 'MMM d, yyyy · h:mm a')}</p>
          {entry.created_by_email && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
              <User className="w-3 h-3 shrink-0" />
              {entry.created_by_email}
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onCopy(entry.id)}
            title="Copy config JSON"
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              isCopied ? 'text-green-500' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {isComparePickMode && !isCompareBaseline ? (
            <button
              onClick={() => onSelectForCompare(entry.id)}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ArrowLeftRight className="w-3 h-3" />
              Compare
            </button>
          ) : !isCompareBaseline && !isComparePickMode ? (
            <button
              onClick={() => onSelectForCompare(entry.id)}
              title="Select to compare"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export default function ConfigHistory({ open, onClose, agentId }: Props) {
  const { entries, pagination, isLoading, error, currentPage, fetchHistory, fetchEntryDetail, goToPage } =
    useConfigHistory(agentId)

  const [screen, setScreen] = useState<Screen>({ mode: 'list' })
  const [compareBaseline, setCompareBaseline] = useState<ComparePickMode | null>(null)
  const [diffDialog, setDiffDialog] = useState<{ entryA: ConfigHistoryEntryDetail; entryB: ConfigHistoryEntryDetail } | null>(null)

  const [detailCache] = useState(() => new Map<string, ConfigHistoryEntryDetail>())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (open && agentId) {
      fetchHistory(1)
      setScreen({ mode: 'list' })
      setCompareBaseline(null)
    }
  }, [open, agentId, fetchHistory])

  const getOrFetchDetail = useCallback(async (id: string): Promise<ConfigHistoryEntryDetail | null> => {
    if (detailCache.has(id)) return detailCache.get(id)!
    const data = await fetchEntryDetail(id)
    if (!data) return null
    detailCache.set(id, data.entry)
    return data.entry
  }, [detailCache, fetchEntryDetail])

  const handleView = useCallback(async (id: string) => {
    setScreen({ mode: 'config', loading: true })
    const detail = await getOrFetchDetail(id)
    if (detail) setScreen({ mode: 'config', detail, loading: false })
    else setScreen({ mode: 'list' })
  }, [getOrFetchDetail])

  const handleCopy = useCallback(async (id: string) => {
    const detail = await getOrFetchDetail(id)
    if (!detail) return
    try {
      const snapshot = JSON.parse(JSON.stringify(detail.config_snapshot))
      // Strip identity/sensitive fields for both LiveKit and Pipecat
      if (snapshot?.agent) {
        delete snapshot.agent.agent_id
        delete snapshot.agent.name
        delete snapshot.agent.type
        delete snapshot.agent.whispey_key_id
        delete snapshot.agent.token
      }
      if (snapshot?.platform === 'pipecat' && snapshot?.agent) {
        delete snapshot.agent.whispey_api_key
        delete snapshot.agent.whispey_agent_id
      }

      const text = buildPortableCopyTextFromSnapshot(snapshot)
      const ok = await copyText(text)
      if (ok) {
        setCopiedId(id)
        setTimeout(() => setCopiedId(prev => prev === id ? null : prev), 2000)
      }
    } catch (err) {
      console.error('Failed to copy portable config:', err)
    }
  }, [getOrFetchDetail])

  const handleSelectForCompare = useCallback(async (id: string) => {
    const entry = entries.find(e => e.id === id)
    if (!entry) return

    if (!compareBaseline) {
      setCompareBaseline({ entryId: id, versionNumber: entry.version_number })
      return
    }

    const [detailA, detailB] = await Promise.all([
      getOrFetchDetail(compareBaseline.entryId),
      getOrFetchDetail(id),
    ])
    if (detailA && detailB) {
      setDiffDialog({ entryA: detailA, entryB: detailB })
    }
    setCompareBaseline(null)
  }, [entries, compareBaseline, getOrFetchDetail])

  const handleStartCompareFromDetail = useCallback((entry: ConfigHistoryEntryDetail) => {
    setCompareBaseline({ entryId: entry.id, versionNumber: entry.version_number })
    setScreen({ mode: 'list' })
  }, [])

  const isComparePickMode = compareBaseline !== null && screen.mode === 'list'

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="right" className="w-[420px] sm:w-[480px] min-w-[420px] sm:min-w-[480px] sm:max-w-none flex flex-col p-0">

          <SheetHeader className="px-4 py-4 border-b shrink-0">
            <SheetTitle className="text-sm font-semibold">
              Version History
            </SheetTitle>
            {screen.mode === 'list' && pagination && (
              <p className="text-xs text-muted-foreground">
                {pagination.total} version{pagination.total !== 1 ? 's' : ''} recorded
              </p>
            )}
          </SheetHeader>

          {screen.mode === 'config' && screen.loading && (
            <div className="flex-1 flex items-center justify-center min-h-[300px] w-full">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {screen.mode === 'config' && !screen.loading && (
            <div className="flex-1 min-h-0 flex flex-col">
              <ConfigDetailView
                entry={screen.detail}
                onBack={() => setScreen({ mode: 'list' })}
                onStartCompare={handleStartCompareFromDetail}
              />
            </div>
          )}

          {screen.mode === 'list' && (
            <>
              {isComparePickMode && (
                <div className="shrink-0 px-4 py-3 bg-primary/10 border-b border-primary/20">
                  <div className="flex items-start gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary">Step 2 — Pick a second version</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Baseline is <span className="font-medium text-foreground">Version #{compareBaseline!.versionNumber}</span>. Click <span className="font-medium text-foreground">Compare</span> on any other entry to see the diff.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {error && <p className="text-xs text-destructive text-center py-8">{error}</p>}
                {!isLoading && !error && entries.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No versions yet</p>
                    <p className="text-xs mt-1">Every config update will appear here automatically.</p>
                  </div>
                )}
                {!isLoading && entries.map(e => (
                  <HistoryEntryRow
                    key={e.id}
                    entry={e}
                    isCompareBaseline={compareBaseline?.entryId === e.id}
                    isComparePickMode={isComparePickMode}
                    copiedId={copiedId}
                    onView={handleView}
                    onCopy={handleCopy}
                    onSelectForCompare={handleSelectForCompare}
                    onCancelBaseline={() => setCompareBaseline(null)}
                  />
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="shrink-0 border-t px-4 py-3 flex items-center justify-between">
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                    disabled={currentPage <= 1 || isLoading} onClick={() => goToPage(currentPage - 1)}>
                    <ChevronLeft className="w-3 h-3 mr-1" /> Newer
                  </Button>
                  <span className="text-xs text-muted-foreground">{currentPage} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                    disabled={!pagination.hasMore || isLoading} onClick={() => goToPage(currentPage + 1)}>
                    Older <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}

        </SheetContent>
      </Sheet>

      {diffDialog && (
        <DiffDialog
          open={true}
          onClose={() => setDiffDialog(null)}
          entryA={diffDialog.entryA}
          entryB={diffDialog.entryB}
        />
      )}
    </>
  )
}