'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, Loader2, Volume2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Voice {
  id: string
  name: string
  provider: 'elevenlabs' | 'sarvam'
  model?: string
}

// Fixed, curated set — not the full catalog. Sarvam's is static (bulbul:v3);
// ElevenLabs voices are account-specific, so those are fetched and capped at 4.
const SARVAM_VOICES: Voice[] = [
  { id: 'shubh', name: 'Shubh', provider: 'sarvam', model: 'bulbul:v3' },
  { id: 'priya', name: 'Priya', provider: 'sarvam', model: 'bulbul:v3' },
  { id: 'rahul', name: 'Rahul', provider: 'sarvam', model: 'bulbul:v3' },
  { id: 'kavya', name: 'Kavya', provider: 'sarvam', model: 'bulbul:v3' },
]

interface MinimalVoicePickerProps {
  selectedVoiceId: string
  selectedProvider: string
  onSelect: (voiceId: string, provider: string, model?: string) => void
  disabled?: boolean
}

// Self-contained "voice" field: a compact trigger showing the current voice,
// opening a small popover with only 8 fixed options — no search, no tabs, no
// per-voice settings.
export default function MinimalVoicePicker({
  selectedVoiceId,
  selectedProvider,
  onSelect,
  disabled,
}: MinimalVoicePickerProps) {
  const [elevenVoices, setElevenVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/elevenlabs-voices')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (cancelled) return
        const voices: Voice[] = (data?.voices ?? [])
          .slice(0, 4)
          .map((v: any) => ({ id: v.voice_id, name: v.name, provider: 'elevenlabs' as const }))
        setElevenVoices(voices)
      })
      .catch(() => !cancelled && setElevenVoices([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const voices = [...elevenVoices, ...SARVAM_VOICES]
  const current = voices.find((v) => v.id === selectedVoiceId && v.provider === selectedProvider)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || loading}
          className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          {loading ? (
            <span className="flex items-center gap-1.5 text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading voice…
            </span>
          ) : (
            <span className="truncate">{current?.name ?? 'Choose a voice'}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="grid grid-cols-2 gap-1.5">
          {voices.map((v) => {
            const isSelected = v.id === selectedVoiceId && v.provider === selectedProvider
            return (
              <button
                key={`${v.provider}-${v.id}`}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelect(v.id, v.provider, v.model)
                  setOpen(false)
                }}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors disabled:opacity-50 ${
                  isSelected
                    ? 'border-gray-900 bg-gray-100 dark:border-gray-100 dark:bg-gray-800'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900'
                }`}
              >
                {isSelected ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <Volume2 className="h-3 w-3 shrink-0 text-gray-400" />
                )}
                <span className="truncate text-gray-800 dark:text-gray-200">{v.name}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
