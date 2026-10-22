// Registry of the TTS providers the voice dialog can show.
//
// The rail, the header chip and the "which tab is this provider on" logic all read from
// here, so the dialog no longer hard-codes a provider count anywhere. To add one:
//   1. add an entry below,
//   2. render its <TabsContent value={key}> in VoiceSelectionPanel and its settings in SettingsPanel,
//   3. teach the payload mappers (lib/tts/*) how to save and reload it.
//
// Class strings are written out in full (no interpolation) so Tailwind can see them.

export interface TtsProviderMeta {
  key: string
  label: string
  /** One short line under the label in the rail. */
  tagline: string
  /** Gradient for the provider's avatar dot. */
  dot: string
  /** Header chip for the currently chosen voice. */
  chip: string
  /** ISO date (YYYY-MM-DD); shows a "New" badge for 30 days after this date. */
  addedAt?: string
  /** Other names the backend/UI have used for the same provider. */
  aliases?: string[]
}

export const TTS_PROVIDERS: TtsProviderMeta[] = [
  {
    key: 'sarvam',
    label: 'Sarvam AI',
    tagline: 'Bulbul · Indic voices',
    dot: 'from-orange-400 to-red-500',
    chip: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
    aliases: ['sarvam_tts'],
  },
  {
    key: 'elevenlabs',
    label: 'ElevenLabs',
    tagline: 'Your voice library',
    dot: 'from-purple-400 to-purple-600',
    chip: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
  },
  {
    key: 'google',
    label: 'Google TTS',
    tagline: 'Cloud voices',
    dot: 'from-blue-400 to-blue-600',
    chip: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  },
  {
    key: 'raya',
    label: 'Raya',
    tagline: 'Bakbak · Indic & English',
    dot: 'from-teal-400 to-emerald-600',
    chip: 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800',
    addedAt: '2026-10-01',
  },
]

export const DEFAULT_TTS_PROVIDER = 'sarvam'

/** Maps any known alias (e.g. `sarvam_tts`) to its canonical key; unknown names pass through. */
export function normalizeTtsProvider(provider?: string | null): string {
  if (!provider) return ''
  const hit = TTS_PROVIDERS.find((p) => p.key === provider || p.aliases?.includes(provider))
  return hit ? hit.key : provider
}

export function getTtsProvider(provider?: string | null): TtsProviderMeta | undefined {
  const key = normalizeTtsProvider(provider)
  return TTS_PROVIDERS.find((p) => p.key === key)
}

export function tabForProvider(provider?: string | null): string {
  return getTtsProvider(provider)?.key ?? DEFAULT_TTS_PROVIDER
}

// Mirrors the 30-day "New" convention the LLM selector uses (ModelSelector.tsx).
const NEW_BADGE_DAYS = 30

export function isNewProvider(addedAt?: string): boolean {
  if (!addedAt) return false
  const added = new Date(addedAt).getTime()
  if (Number.isNaN(added)) return false
  return Date.now() - added < NEW_BADGE_DAYS * 24 * 60 * 60 * 1000
}
