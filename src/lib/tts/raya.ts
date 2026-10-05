// Raya (Bakbak) TTS contract — https://docs.litwizlabs.com (TTSRequest in the OpenAPI spec).
//
// Single source of truth for everything Raya-specific on the frontend: what can be
// customised, the allowed values, and how a dialog selection maps to / from the `tts`
// object persisted on an assistant. Keep it free of React so every consumer
// (dialog, dynamic-TTS, language-switch, save serializers) shares one mapping.
//
// The backend enforces the same contract in utils/raya_tts_config.py.

export const RAYA_PROVIDER = 'raya'

export const RAYA_MODELS = [
  { value: 'm1', label: 'M1', hint: 'Alternative model with its own voice set' },
  { value: 'standard', label: 'Standard', hint: 'Default synthesis model' },
] as const

// `native` is the language's own name, shown beside the English one; empty when it adds nothing.
export const RAYA_LANGUAGES = [
  { value: 'hi', label: 'Hindi', native: 'हिंदी' },
  { value: 'en-in', label: 'Indian English', native: '' },
  { value: 'mr', label: 'Marathi', native: 'मराठी' },
  { value: 'te', label: 'Telugu', native: 'తెలుగు' },
  { value: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { value: 'bn', label: 'Bengali', native: 'বাংলা' },
  { value: 'as', label: 'Assamese', native: 'অসমীয়া' },
  { value: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { value: 'ne', label: 'Nepali', native: 'नेपाली' },
  { value: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { value: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { value: 'en-us', label: 'US English', native: '' },
] as const

export const RAYA_SAMPLE_RATES = [
  { value: 8000, label: '8 kHz', hint: 'Telephony, lowest bandwidth' },
  { value: 16000, label: '16 kHz', hint: 'Balanced quality and size' },
  { value: 22050, label: '22.05 kHz', hint: 'Good quality' },
  { value: 24000, label: '24 kHz', hint: 'High quality (default)' },
] as const

export const RAYA_SPEED = { min: 0.5, max: 1.5, step: 0.05, default: 1 } as const

// Speed presets follow the guidance in Raya's best-practices page.
export const RAYA_SPEED_PRESETS = [
  { value: 0.8, label: 'Slow & clear' },
  { value: 1, label: 'Normal' },
  { value: 1.2, label: 'Brisk' },
] as const

export const RAYA_DEFAULT_MODEL = 'm1'
export const RAYA_DEFAULT_LANGUAGE = 'hi'
export const RAYA_DEFAULT_SAMPLE_RATE = 24000

// Raya's documented example voice (m1, Hindi). Offered as a one-click starting point
// when the voice catalogue can't be loaded, so setup is never blocked on the list call.
export const RAYA_STARTER_VOICE = {
  id: '3fe4afbc-3bde-4c97-ab8e-37e3fb8c7ba2',
  name: 'Default voice',
  language: 'hi',
  model: 'm1',
} as const

/** What the dialog edits. Field names match the persisted `voice_settings` / plugin kwargs. */
export interface RayaConfig {
  language: string
  model: string
  speed: number
  sample_rate: number
}

export interface RayaVoice {
  id: string
  name: string
  language: string
  model: string
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/**
 * Accepts the codes other providers use (hi-IN, en, ta_IN) so switching an agent over
 * from Sarvam/ElevenLabs keeps a sensible language. Mirrors raya_language() in the backend.
 */
export function normalizeRayaLanguage(raw?: string | null): string {
  let code = String(raw ?? '').trim().toLowerCase().replaceAll('_', '-')
  if (code === 'en') return 'en-in'
  if (code.endsWith('-in') && code !== 'en-in') code = code.slice(0, -3)
  return RAYA_LANGUAGES.some((l) => l.value === code) ? code : RAYA_DEFAULT_LANGUAGE
}

export function normalizeRayaConfig(raw: Partial<Record<keyof RayaConfig | 'pace', unknown>> = {}): RayaConfig {
  const model = String(raw.model ?? '')
  const sampleRate = Number(raw.sample_rate)
  // `||` rather than `??`: a stored speed of 0 is never meaningful and would clamp to the minimum.
  const speed = Number(raw.speed || raw.pace || RAYA_SPEED.default)
  return {
    language: normalizeRayaLanguage(raw.language as string | undefined),
    model: RAYA_MODELS.some((m) => m.value === model) ? model : RAYA_DEFAULT_MODEL,
    speed: Number.isFinite(speed)
      ? Math.round(clamp(speed, RAYA_SPEED.min, RAYA_SPEED.max) * 100) / 100
      : RAYA_SPEED.default,
    sample_rate: RAYA_SAMPLE_RATES.some((r) => r.value === sampleRate) ? sampleRate : RAYA_DEFAULT_SAMPLE_RATE,
  }
}

/**
 * Persisted `tts` shape for an assistant / fallback / dynamic-TTS entry.
 *
 * `voice_settings` carries ElevenLabs-shaped placeholders because the backend's
 * TTSVoiceSettings model requires them on every provider (the Sarvam payload does the
 * same). The Raya builder ignores them and reads only `speed` and `sample_rate`.
 */
export function rayaTtsPayload(voiceId: string, model: string | undefined, config?: Partial<RayaConfig>) {
  const c = normalizeRayaConfig({ ...config, model: model ?? config?.model })
  return {
    name: RAYA_PROVIDER,
    voice_id: voiceId,
    model: c.model,
    language: c.language,
    voice_settings: {
      similarity_boost: 1,
      stability: 0.8,
      style: 1,
      use_speaker_boost: true,
      speed: c.speed,
      sample_rate: c.sample_rate,
    },
  }
}

/** Inverse of rayaTtsPayload: the stored `tts` object back into dialog config. */
export function rayaConfigFromTts(tts: any): RayaConfig {
  return normalizeRayaConfig({
    language: tts?.language,
    model: tts?.model,
    speed: tts?.voice_settings?.speed ?? tts?.speed,
    sample_rate: tts?.voice_settings?.sample_rate ?? tts?.sample_rate,
  })
}

/** Short native-script line for the preview button, so each language is heard in its own script. */
export const RAYA_PREVIEW_TEXT: Record<string, string> = {
  hi: 'नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?',
  mr: 'नमस्कार! मी तुम्हाला कशी मदत करू शकतो?',
  te: 'నమస్కారం! నేను మీకు ఎలా సహాయం చేయగలను?',
  kn: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
  bn: 'নমস্কার! আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
  as: 'নমস্কাৰ! মই আপোনাক কেনেকৈ সহায় কৰিব পাৰোঁ?',
  gu: 'નમસ્તે! હું તમને કેવી રીતે મદદ કરી શકું?',
  ne: 'नमस्ते! म तपाईंलाई कसरी मद्दत गर्न सक्छु?',
  ml: 'നമസ്കാരം! ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?',
  ta: 'வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்?',
  'en-in': 'Hello! How can I help you today?',
  'en-us': 'Hello! How can I help you today?',
}

/**
 * Instruction to paste into an agent prompt. Raya reads Indic names far more accurately in
 * Devanagari, and Hindi must be Devanagari (romanised Hindi is unsupported), per Raya's docs.
 */
export const RAYA_PROMPT_SNIPPET =
  'Write all Hindi text in Devanagari script, never romanised. When replying in English, write Indian names, places and brands in Devanagari (for example "राहुल from मुंबई"), because the voice pronounces them far more accurately that way.'
