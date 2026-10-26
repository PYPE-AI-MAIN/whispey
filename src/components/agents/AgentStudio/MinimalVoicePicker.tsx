'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MCP_ELEVENLABS_VOICES, MCP_SARVAM_VOICES } from '@/config/mcpAgentVoices'

export interface StudioVoice {
  id: string
  name: string
  /** Descriptor after the dash in names like "Vidya - Famous News Personality". */
  subtitle?: string
  tags: string[]
  provider: 'elevenlabs' | 'sarvam'
  model?: string
  /** Other ids a saved config may hold for this voice (e.g. Sarvam's short MCP id). */
  aliases?: string[]
}

// Same curated list the MCP validates create_agent/update_agent voice
// selections against (src/config/mcpAgentVoices.ts) — one source of truth,
// so a voice set through the MCP always shows up as selected here too.
// The id is the real Sarvam speaker string — that's what the MCP writes to
// tts.speaker and what the backend/preview API need. The short MCP id is kept
// as an alias so configs saved with it still show as selected.
const SARVAM_VOICES: StudioVoice[] = MCP_SARVAM_VOICES.map((v) => ({
  id: v.sarvamSpeaker,
  aliases: [v.voice_id],
  name: v.name,
  tags: ['Indian', 'Multilingual'],
  provider: 'sarvam' as const,
  model: v.model,
}))

/** Whether a saved (voiceId, provider) pair refers to this voice. */
export function isSameVoice(voice: StudioVoice, voiceId: string, provider: string): boolean {
  return voice.provider === provider && (voice.id === voiceId || !!voice.aliases?.includes(voiceId))
}

const PREVIEW_TEXT = 'Hi there! This is how I sound.'

const voiceKey = (v: Pick<StudioVoice, 'provider' | 'id'>) => `${v.provider}-${v.id}`

const titleCase = (s: string) => s.replaceAll(/[_-]/g, ' ').replaceAll(/\b\w/g, (c) => c.toUpperCase())

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

// Curated ElevenLabs voices with only our own metadata — used when the live
// fetch is missing a voice or fails outright, so MCP-set voices still match.
const CURATED_ELEVEN_VOICES: StudioVoice[] = MCP_ELEVENLABS_VOICES.map((v) => ({
  id: v.voice_id,
  name: v.name,
  tags: [],
  provider: 'elevenlabs' as const,
  model: v.model,
}))

export function useStudioVoices() {
  const [elevenVoices, setElevenVoices] = useState<StudioVoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/elevenlabs-voices')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (cancelled) return
        const byId = new Map((data?.voices ?? []).map((v: any) => [v.voice_id, v]))
        // Same curated 4 ids as MCP_ELEVENLABS_VOICES, in that order — not
        // "whichever 4 the API returns first". Falls back to our own name if
        // one isn't present in the live fetch (e.g. account access hiccup).
        setElevenVoices(
          MCP_ELEVENLABS_VOICES.map((curated) => {
            const live: any = byId.get(curated.voice_id)
            if (!live) return CURATED_ELEVEN_VOICES.find((v) => v.id === curated.voice_id)!
            const { name, subtitle } = splitName(live.name ?? curated.name)
            return {
              id: curated.voice_id,
              name,
              subtitle: subtitle ?? live.labels?.description ?? live.description,
              tags: labelsToTags(live.labels),
              provider: 'elevenlabs' as const,
              model: curated.model,
            }
          })
        )
      })
      .catch(() => !cancelled && setElevenVoices(CURATED_ELEVEN_VOICES))
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

function avatarTone(voice?: StudioVoice): string {
  if (!voice) return 'bg-muted-foreground/30'
  return voice.provider === 'sarvam'
    ? 'bg-gradient-to-br from-orange-400 to-rose-500'
    : 'bg-gradient-to-br from-primary to-primary/80'
}

export function VoiceAvatar({ voice, size = 'md' }: Readonly<{ voice?: StudioVoice; size?: 'sm' | 'md' }>) {
  return (
    <span
      style={size === 'sm' ? { width: 20, height: 20 } : { width: 32, height: 32 }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        avatarTone(voice)
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
        'relative flex shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-semibold text-white',
        voice.provider === 'sarvam'
          ? 'bg-gradient-to-br from-orange-400 to-rose-500'
          : 'bg-gradient-to-br from-primary to-primary/80'
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
        <OrbIcon loading={loading} playing={playing} />
      </span>
    </button>
  )
}

function OrbIcon({ loading, playing }: Readonly<{ loading: boolean; playing: boolean }>) {
  if (loading) return <Loader2 className="h-4 w-4 animate-spin" />
  if (playing) return <Pause className="h-4 w-4 fill-current" />
  return <Play className="ml-0.5 h-4 w-4 fill-current" />
}

function voiceSubtitle(current: StudioVoice | undefined): string {
  if (!current) return 'Current voice isn’t in the curated list'
  // Never name the TTS vendor in the UI — describe the voice instead.
  return current.tags.join(' · ') || current.subtitle || ''
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
}: Readonly<MinimalVoicePickerProps>) {
  const [open, setOpen] = useState(false)
  const preview = useVoicePreview()
  const current = voices.find((v) => isSameVoice(v, selectedVoiceId, selectedProvider))
  const groups = (['elevenlabs', 'sarvam'] as const)
    .map((p) => ({ provider: p, items: voices.filter((v) => v.provider === p) }))
    .filter((g) => g.items.length > 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Anchor the list to the whole row, not just the text button inside it. */}
      <PopoverAnchor asChild>
      <div className="flex h-12 w-full items-center gap-2.5 rounded-lg border border-border bg-card pl-2 pr-1 transition hover:border-border">
        {loading ? (
          <span className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
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
                className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {current?.name ?? 'Choose a voice'}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {voiceSubtitle(current)}
                  </span>
                </span>
                <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
        className="border-border bg-card p-1.5 shadow-xl"
      >
        <div style={{ maxHeight: 360 }} className="overflow-y-auto">
          {preview.error && (
            <p className="mx-1.5 mb-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              {preview.error}
            </p>
          )}
          {groups.map((g) => (
            <div key={g.provider} className="pb-1 pt-1">
              {g.items.map((v) => {
                const key = voiceKey(v)
                const isSelected = current ? voiceKey(v) === voiceKey(current) : false
                return (
                  // Row selects; the orb previews. A div with role=menuitemradio (not a
                  // button) because the orb inside is itself a button.
                  <div
                    key={key}
                    role="menuitemradio"
                    aria-checked={isSelected}
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
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                    )}
                  >
                    <PlayOrb
                      voice={v}
                      playing={preview.playingKey === key}
                      loading={preview.loadingKey === key}
                      onToggle={() => preview.toggle(v)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{v.name}</p>
                      {v.subtitle && (
                        <p className="truncate text-[11px] text-muted-foreground">{v.subtitle}</p>
                      )}
                      {v.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {v.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-border px-1.5 py-px text-[10px] text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
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
