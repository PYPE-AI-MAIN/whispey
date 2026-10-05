import React, { useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  Copy,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Search,
  Square,
  KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  RAYA_LANGUAGES,
  RAYA_MODELS,
  RAYA_PROVIDER,
  RAYA_STARTER_VOICE,
  normalizeRayaLanguage,
  type RayaConfig,
  type RayaVoice,
} from '@/lib/tts/raya'
import { useVoicePreview } from '../useVoicePreview'
import type { RayaVoicesState } from './useRayaVoices'

const MAX_PREVIEW_CHARS = 200

const languageLabel = (code: string) => {
  const lang = RAYA_LANGUAGES.find((l) => l.value === normalizeRayaLanguage(code))
  return lang ? lang.label : code
}

type Catalogue = RayaVoicesState & { refresh: () => Promise<void> | void }

interface RayaVoicePanelProps {
  config: RayaConfig
  setConfig: React.Dispatch<React.SetStateAction<RayaConfig>>
  selectedVoiceId: string
  selectedProvider: string
  onVoiceSelect: (voiceId: string, provider: string) => void
  catalogue: Catalogue
}

function CopyId({ id }: Readonly<{ id: string }>) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-7 h-7 p-0"
      title="Copy voice ID"
      aria-label="Copy voice ID"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          /* clipboard can be blocked; nothing useful to tell the user */
        }
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </Button>
  )
}

function Notice({
  icon: Icon,
  title,
  children,
  tone = 'neutral',
}: Readonly<{
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
  tone?: 'neutral' | 'warn'
}>) {
  const toneClass =
    tone === 'warn'
      ? 'border-amber-300/70 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/20'
      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${tone === 'warn' ? 'text-amber-500' : 'text-gray-400'}`} />
        <div className="space-y-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  )
}

// Keyed by the `code` /api/raya-voices returns, so each failure reads as what it is.
const KEY_PROBLEM_COPY = {
  not_configured: 'Raya isn’t connected yet',
  invalid_key: 'Raya rejected the API key',
} as const

function CatalogueError({
  errorCode,
  error,
  onRetry,
  onUseStarter,
}: Readonly<{
  errorCode: string | null
  error: string | null
  onRetry: () => void
  onUseStarter: () => void
}>) {
  const keyProblemTitle = errorCode ? KEY_PROBLEM_COPY[errorCode as keyof typeof KEY_PROBLEM_COPY] : undefined
  return (
    <div className="space-y-3 overflow-y-auto">
      <Notice
        icon={keyProblemTitle ? KeyRound : AlertCircle}
        tone="warn"
        title={keyProblemTitle ?? 'Couldn’t load Raya voices'}
      >
        {keyProblemTitle ? (
          <p>
            Set <code className="font-mono">RAYA_API_KEY</code> in this app&apos;s server environment, restart it,
            then refresh. Agents also need the same key on the voice workers.
          </p>
        ) : (
          <p>{error}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try again
          </Button>
          <Button variant="outline" size="sm" onClick={onUseStarter}>
            Use Raya&apos;s default voice
          </Button>
        </div>
      </Notice>
    </div>
  )
}

function PreviewIcon({ loading, playing }: Readonly<{ loading: boolean; playing: boolean }>) {
  if (loading) return <Loader2 className="w-3.5 h-3.5 animate-spin" />
  if (playing) return <Square className="w-3.5 h-3.5 fill-current" />
  return <Play className="w-3.5 h-3.5 fill-current" />
}

// The selectable area is a real <button>; preview and copy sit beside it rather than
// inside it, since interactive elements can't nest in a button.
function VoiceCard({
  voice,
  isSelected,
  isPlaying,
  isLoadingPreview,
  onSelect,
  onPreview,
}: Readonly<{
  voice: RayaVoice
  isSelected: boolean
  isPlaying: boolean
  isLoadingPreview: boolean
  onSelect: () => void
  onPreview: () => void
}>) {
  const cardClass = isSelected
    ? 'border-teal-300 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/10'
    : 'border-gray-200 dark:border-gray-700 hover:border-teal-200 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-900/5'
  const previewClass = isPlaying
    ? 'opacity-100 text-teal-500'
    : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-gray-400 hover:text-teal-500'
  const previewLabel = isPlaying ? 'Stop preview' : `Preview ${voice.name}`

  return (
    <div className={`group flex items-center gap-2 p-2 rounded-md border transition-all hover:shadow-sm ${cardClass}`}>
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        className="flex flex-1 min-w-0 items-center gap-2 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
          {voice.name.charAt(0).toUpperCase()}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">{voice.name}</span>
            {isSelected && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
          </span>
          <span className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300">
              {languageLabel(voice.language)}
            </span>
            <code className="text-[11px] text-gray-400 truncate max-w-[12rem]">{voice.id}</code>
          </span>
        </span>
      </button>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={isLoadingPreview}
          onClick={onPreview}
          className={`w-7 h-7 p-0 transition-opacity ${previewClass}`}
          title={isPlaying ? 'Stop preview' : 'Preview voice'}
          aria-label={previewLabel}
        >
          <PreviewIcon loading={isLoadingPreview} playing={isPlaying} />
        </Button>
        <CopyId id={voice.id} />
      </div>
    </div>
  )
}

function ModelSwitch({ model, onChange }: Readonly<{ model: string; onChange: (model: string) => void }>) {
  return (
    <div className="flex-shrink-0 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Model</span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {RAYA_MODELS.find((m) => m.value === model)?.hint}
        </span>
      </div>
      <div role="radiogroup" aria-label="Raya model" className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
        {RAYA_MODELS.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={model === m.value}
            onClick={() => onChange(m.value)}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              model === m.value
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function LanguageChips({
  total,
  languages,
  value,
  onChange,
}: Readonly<{
  total: number
  languages: [string, number][]
  value: string
  onChange: (code: string) => void
}>) {
  const chips: [string, number][] = [['all', total], ...languages]
  return (
    <fieldset className="flex-shrink-0 min-w-0 m-0 border-0 p-0">
      <legend className="sr-only">Filter by language</legend>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {chips.map(([code, count]) => {
          const active = value === code
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(code)}
              className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? 'border-teal-300 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {code === 'all' ? 'All' : languageLabel(code)} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ManualVoiceEntry({ model, onUse }: Readonly<{ model: string; onUse: (id: string) => void }>) {
  const [manualId, setManualId] = useState('')
  return (
    <details className="group rounded-lg border border-gray-200 dark:border-gray-700 flex-shrink-0">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 list-none flex items-center justify-between">
        Have a voice ID?
        <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
      </summary>
      <div className="px-3 pb-3 space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Use an ID from your Raya account that isn&apos;t listed. It must belong to the <b>{model}</b> model.
        </p>
        <div className="flex gap-2">
          <Input
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="Voice ID"
            aria-label="Raya voice ID"
            className="h-9 font-mono text-xs"
          />
          <Button
            variant="outline"
            className="h-9"
            disabled={!manualId.trim()}
            onClick={() => {
              onUse(manualId.trim())
              setManualId('')
            }}
          >
            Use
          </Button>
        </div>
      </div>
    </details>
  )
}

interface VoiceListProps {
  catalogue: Catalogue
  model: string
  modelVoices: RayaVoice[]
  visible: RayaVoice[]
  selectedVoiceId: string
  selectedProvider: string
  playingId: string | null
  loadingId: string | null
  onPick: (voice: RayaVoice) => void
  onPreview: (voice: RayaVoice) => void
  onRetry: () => void
  onUseStarter: () => void
}

function VoiceList(props: Readonly<VoiceListProps>) {
  const { catalogue, model, modelVoices, visible, selectedVoiceId, selectedProvider, playingId, loadingId } = props
  const hasCatalogue = catalogue.voices.length > 0

  if ((catalogue.status === 'loading' || catalogue.status === 'idle') && !hasCatalogue) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-400 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading Raya voices…
      </div>
    )
  }
  if (catalogue.status === 'error' && !hasCatalogue) {
    return (
      <CatalogueError
        errorCode={catalogue.errorCode}
        error={catalogue.error}
        onRetry={props.onRetry}
        onUseStarter={props.onUseStarter}
      />
    )
  }
  if (modelVoices.length === 0) {
    return (
      <Notice icon={Mic} title={`No ${model} voices on this account`}>
        <p>Try the other model, or add a voice ID by hand below.</p>
      </Notice>
    )
  }
  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Mic className="w-10 h-10 text-gray-300 dark:text-gray-600" />
        No voices match your filters.
      </div>
    )
  }
  return (
    <ul className="space-y-2 overflow-y-auto pr-1">
      {visible.map((voice) => (
        <li key={voice.id} data-voice-id={voice.id}>
          <VoiceCard
            voice={voice}
            isSelected={selectedProvider === RAYA_PROVIDER && selectedVoiceId === voice.id}
            isPlaying={playingId === voice.id}
            isLoadingPreview={loadingId === voice.id}
            onSelect={() => props.onPick(voice)}
            onPreview={() => props.onPreview(voice)}
          />
        </li>
      ))}
    </ul>
  )
}

const matchesSearch = (voice: RayaVoice, query: string) =>
  !query ||
  voice.name.toLowerCase().includes(query) ||
  voice.id.toLowerCase().includes(query) ||
  languageLabel(voice.language).toLowerCase().includes(query)

export default function RayaVoicePanel({
  config,
  setConfig,
  selectedVoiceId,
  selectedProvider,
  onVoiceSelect,
  catalogue,
}: Readonly<RayaVoicePanelProps>) {
  const [search, setSearch] = useState('')
  const [languageFilter, setLanguageFilter] = useState<string>('all')
  const [previewText, setPreviewText] = useState('')
  const { playingId, loadingId, toggle } = useVoicePreview()

  const { voices, status } = catalogue
  const hasCatalogue = voices.length > 0
  const reload = () => {
    catalogue.refresh()
  }

  // Voice ids are bound to a model (a standard id fails on m1 and vice versa), so the list
  // only ever offers voices that will actually work with the chosen model.
  const modelVoices = useMemo(() => voices.filter((v) => v.model === config.model), [voices, config.model])

  const languagesInModel = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of modelVoices) counts.set(v.language, (counts.get(v.language) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [modelVoices])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return modelVoices.filter((v) => (languageFilter === 'all' || v.language === languageFilter) && matchesSearch(v, q))
  }, [modelVoices, languageFilter, search])

  const handleModelChange = (model: string) => {
    if (model === config.model) return
    setConfig((prev) => ({ ...prev, model }))
    setLanguageFilter('all')
    // Drop the selection if it can't work with the new model. Only decidable once the
    // catalogue is loaded; a hand-typed id is left alone because we can't know.
    if (selectedProvider === RAYA_PROVIDER && selectedVoiceId && hasCatalogue) {
      const current = voices.find((v) => v.id === selectedVoiceId)
      if (current && current.model !== model) onVoiceSelect('', RAYA_PROVIDER)
    }
  }

  const pickVoice = (voice: Pick<RayaVoice, 'id' | 'language' | 'model'>) => {
    // The voice decides the model (ids don't cross models) and the language it speaks.
    setConfig((prev) => ({
      ...prev,
      model: RAYA_MODELS.some((m) => m.value === voice.model) ? voice.model : prev.model,
      language: voice.language ? normalizeRayaLanguage(voice.language) : prev.language,
    }))
    onVoiceSelect(voice.id, RAYA_PROVIDER)
  }

  const previewVoice = (voice: RayaVoice) =>
    toggle(voice.id, async () => {
      const response = await fetch('/api/raya-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_id: voice.id,
          model: voice.model || config.model,
          language: normalizeRayaLanguage(voice.language || config.language),
          speed: config.speed,
          ...(previewText.trim() && { text: previewText.trim() }),
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Preview failed' }))
        throw new Error(err.error || 'Preview failed')
      }
      const blob = await response.blob()
      if (blob.type.includes('json') || blob.type.includes('text')) {
        throw new Error('Unexpected response from preview API')
      }
      return blob
    })

  return (
    <div className="h-full p-6 flex flex-col gap-4 overflow-hidden">
      <div className="flex gap-3 flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, language or ID…"
            aria-label="Search Raya voices"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={reload}
          disabled={status === 'loading'}
          className="h-10 px-4"
          title="Reload the voice list from Raya"
        >
          {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {/* Model: voices are model-specific, so this filters the list below. */}
      <ModelSwitch model={config.model} onChange={handleModelChange} />

      {languagesInModel.length > 1 && (
        <LanguageChips
          total={modelVoices.length}
          languages={languagesInModel}
          value={languageFilter}
          onChange={setLanguageFilter}
        />
      )}

      {hasCatalogue && (
        <div className="flex-shrink-0">
          <Input
            value={previewText}
            maxLength={MAX_PREVIEW_CHARS}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Preview line (optional) — try a name or number in Devanagari"
            aria-label="Custom preview text"
            className="h-9 text-xs"
          />
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <VoiceList
          catalogue={catalogue}
          model={config.model}
          modelVoices={modelVoices}
          visible={visible}
          selectedVoiceId={selectedVoiceId}
          selectedProvider={selectedProvider}
          playingId={playingId}
          loadingId={loadingId}
          onPick={pickVoice}
          onPreview={previewVoice}
          onRetry={reload}
          onUseStarter={() => pickVoice(RAYA_STARTER_VOICE)}
        />
      </div>

      {status === 'error' && hasCatalogue && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
          Couldn&apos;t refresh the list — showing the last one loaded.
        </p>
      )}

      <ManualVoiceEntry model={config.model} onUse={(id) => pickVoice({ id, language: '', model: config.model })} />
    </div>
  )
}
