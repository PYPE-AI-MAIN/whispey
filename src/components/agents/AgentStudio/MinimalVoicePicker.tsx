'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface StudioVoice {
  id: string
  name: string
  /** Descriptor after the dash in names like "Vidya - Famous News Personality". */
  subtitle?: string
  tags: string[]
  provider: 'elevenlabs' | 'sarvam'
  model?: string
}

// Fixed, curated set — not the full catalog. Sarvam's is static (bulbul:v3);
// ElevenLabs voices are account-specific, so those are fetched and capped at 4.
const SARVAM_VOICES: StudioVoice[] = [
  { id: 'shubh', name: 'Shubh', subtitle: 'Warm, natural default voice', tags: ['Male', 'Indian', 'Multilingual'], provider: 'sarvam', model: 'bulbul:v3' },
  { id: 'priya', name: 'Priya', subtitle: 'Clear and friendly', tags: ['Female', 'Indian', 'Multilingual'], provider: 'sarvam', model: 'bulbul:v3' },
  { id: 'rahul', name: 'Rahul', subtitle: 'Calm and steady', tags: ['Male', 'Indian', 'Multilingual'], provider: 'sarvam', model: 'bulbul:v3' },
  { id: 'kavya', name: 'Kavya', subtitle: 'Bright and conversational', tags: ['Female', 'Indian', 'Multilingual'], provider: 'sarvam', model: 'bulbul:v3' },
]

const PROVIDER_LABEL: Record<StudioVoice['provider'], string> = {
  elevenlabs: 'ElevenLabs',
  sarvam: 'Sarvam',
}

const PREVIEW_TEXT = 'Hi there! This is how I sound.'

const voiceKey = (v: Pick<StudioVoice, 'provider' | 'id'>) => `${v.provider}-${v.id}`

const titleCase = (s: string) => s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function splitName(raw: string): { name: string; subtitle?: string } {
  const [name, ...rest] = raw.split(/\s[-–]\s/)
  return { name: name.trim(), subtitle: rest.join(' – ').trim() || undefined }
}

function labelsToTags(labels: Record<string, string> | undefined): string[] {
  if (!labels) return []
  return ['gender', 'accent', 'use_case', 'age']
    .map((k) => labels[k])
    .filter(Boolean)
    .map(titleCase)
    .slice(0, 3)
}

export function useStudioVoices() {
  const [elevenVoices, setElevenVoices] = useState<StudioVoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/elevenlabs-voices')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (cancelled) return
        setElevenVoices(
          (data?.voices ?? []).slice(0, 4).map((v: any) => {
            const { name, subtitle } = splitName(v.name ?? '')
            return {
              id: v.voice_id,
              name,
              subtitle: subtitle ?? v.labels?.description ?? v.description,
              tags: labelsToTags(v.labels),
              provider: 'elevenlabs' as const,
            }
          })
        )
      })
      .catch(() => !cancelled && setElevenVoices([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  return { voices: [...elevenVoices, ...SARVAM_VOICES], loading }
}

/** One preview at a time; clicking the playing voice again stops it. */
function useVoicePreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setPlayingKey(null)
  }, [])

  useEffect(() => stop, [stop])

  const toggle = useCallback(
    async (voice: StudioVoice) => {
      const key = voiceKey(voice)
      if (playingKey === key) {
        stop()
        return
      }
      stop()
      setError(null)
      setLoadingKey(key)
      try {
        const res =
          voice.provider === 'sarvam'
            ? await fetch('/api/sarvam-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: PREVIEW_TEXT, speaker: voice.id, model: voice.model }),
              })
            : await fetch('/api/elevenlabs-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: PREVIEW_TEXT, voice_id: voice.id }),
              })
        if (!res.ok) throw new Error('Preview failed')
        const blob = await res.blob()
        if (blob.type.includes('json') || blob.type.includes('text')) throw new Error('Preview failed')

        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        urlRef.current = url
        audio.onended = stop
        await audio.play()
        setPlayingKey(key)
      } catch {
        stop()
        setError(`Couldn’t play ${voice.name}`)
      } finally {
        setLoadingKey(null)
      }
    },
    [playingKey, stop]
  )

  return { playingKey, loadingKey, error, toggle }
}

export function VoiceAvatar({ voice, size = 'md' }: Readonly<{ voice?: StudioVoice; size?: 'sm' | 'md' }>) {
  return (
    <span
      style={size === 'sm' ? { width: 20, height: 20 } : { width: 32, height: 32 }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        voice?.provider === 'sarvam'
          ? 'bg-gradient-to-br from-orange-400 to-rose-500'
          : voice
            ? 'bg-gradient-to-br from-violet-500 to-indigo-500'
            : 'bg-gray-300 dark:bg-gray-700'
      )}
    >
      {voice?.name?.[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

/** ElevenLabs-style orb: shows the initial, turns into play/pause on hover or while playing. */
function PlayOrb({
  voice, playing, loading, onToggle,
}: Readonly<{ voice: StudioVoice; playing: boolean; loading: boolean; onToggle: () => void }>) {
  const [hovered, setHovered] = useState(false)
  const showControl = hovered || playing || loading

  return (
    <button
      type="button"
      aria-label={playing ? `Stop ${voice.name} preview` : `Play ${voice.name} preview`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        width: 36,
        height: 36,
        transform: hovered ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 150ms ease',
      }}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white',
        voice.provider === 'sarvam'
          ? 'bg-gradient-to-br from-orange-400 to-rose-500'
          : 'bg-gradient-to-br from-violet-500 to-indigo-500'
      )}
    >
      {playing && <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />}
      <span style={{ opacity: showControl ? 0 : 1, transition: 'opacity 150ms ease' }}>
        {voice.name[0]?.toUpperCase()}
      </span>
      <span
        style={{ opacity: showControl ? 1 : 0, transition: 'opacity 150ms ease', background: 'rgba(0,0,0,0.25)' }}
        className="absolute inset-0 flex items-center justify-center rounded-full"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        )}
      </span>
    </button>
  )
}

interface MinimalVoicePickerProps {
  voices: StudioVoice[]
  loading: boolean
  selectedVoiceId: string
  selectedProvider: string
  onSelect: (voiceId: string, provider: string, model?: string) => void
  disabled?: boolean
}

export default function MinimalVoicePicker({
  voices,
  loading,
  selectedVoiceId,
  selectedProvider,
  onSelect,
  disabled,
}: MinimalVoicePickerProps) {
  const [open, setOpen] = useState(false)
  const preview = useVoicePreview()
  const current = voices.find((v) => v.id === selectedVoiceId && v.provider === selectedProvider)
  const groups = (['elevenlabs', 'sarvam'] as const)
    .map((p) => ({ provider: p, items: voices.filter((v) => v.provider === p) }))
    .filter((g) => g.items.length > 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Anchor the list to the whole row, not just the text button inside it. */}
      <PopoverAnchor asChild>
      <div className="flex h-12 w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-white pl-2 pr-1 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600">
        {loading ? (
          <span className="flex items-center gap-2 pl-1 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading voices…
          </span>
        ) : (
          <>
            {current ? (
              <PlayOrb
                voice={current}
                playing={preview.playingKey === voiceKey(current)}
                loading={preview.loadingKey === voiceKey(current)}
                onToggle={() => preview.toggle(current)}
              />
            ) : (
              <VoiceAvatar />
            )}
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="flex h-full min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">
                    {current?.name ?? 'Choose a voice'}
                  </span>
                  <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">
                    {current ? `${PROVIDER_LABEL[current.provider]}${current.tags[0] ? ` · ${current.tags.join(' · ')}` : ''}` : 'Current voice isn’t in the curated list'}
                  </span>
                </span>
                <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              </button>
            </PopoverTrigger>
          </>
        )}
      </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        style={{ width: 'var(--radix-popover-trigger-width)', minWidth: 340 }}
        className="border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div style={{ maxHeight: 360 }} className="overflow-y-auto">
          {preview.error && (
            <p className="mx-1.5 mb-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              {preview.error}
            </p>
          )}
          {groups.map((g) => (
            <div key={g.provider} className="pb-1">
              <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {PROVIDER_LABEL[g.provider]}
              </p>
              {g.items.map((v) => {
                const key = voiceKey(v)
                const isSelected = v.id === selectedVoiceId && v.provider === selectedProvider
                return (
                  // Row selects; the orb previews. A div with role=option (not a
                  // button) because the orb inside is itself a button.
                  <div
                    key={key}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={() => {
                      onSelect(v.id, v.provider, v.model)
                      setOpen(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(v.id, v.provider, v.model)
                        setOpen(false)
                      }
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40',
                      isSelected ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/70'
                    )}
                  >
                    <PlayOrb
                      voice={v}
                      playing={preview.playingKey === key}
                      loading={preview.loadingKey === key}
                      onToggle={() => preview.toggle(v)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{v.name}</p>
                      {v.subtitle && (
                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{v.subtitle}</p>
                      )}
                      {v.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {v.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-gray-200 px-1.5 py-px text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
