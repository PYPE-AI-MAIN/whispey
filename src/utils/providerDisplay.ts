// Known LiveKit plugin module segments -> display name. Falls back to a
// capitalized guess for providers not in this list, since new plugins ship
// regularly and we'd rather show a reasonable name than nothing.
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  deepgram: "Deepgram",
  sarvam: "Sarvam",
  elevenlabs: "ElevenLabs",
  openai: "OpenAI",
  anthropic: "Anthropic",
  cartesia: "Cartesia",
  groq: "Groq",
  google: "Google",
  azure: "Azure",
  assemblyai: "AssemblyAI",
  speechmatics: "Speechmatics",
  playht: "PlayHT",
  rime: "Rime",
  smallestai: "Smallest AI",
  aws: "AWS",
  cerebras: "Cerebras",
}

// Turns a raw class path like "livekit.plugins.deepgram.stt.STT" into "Deepgram".
// Falls back to the raw label unchanged if it doesn't match the expected shape.
export const formatProviderLabel = (rawLabel?: string): string => {
  if (!rawLabel) return "unknown"
  const parts = rawLabel.split(".")
  const pluginsIdx = parts.indexOf("plugins")
  const key = pluginsIdx >= 0 ? parts[pluginsIdx + 1] : undefined
  if (!key) return rawLabel
  return PROVIDER_DISPLAY_NAMES[key.toLowerCase()] || (key.charAt(0).toUpperCase() + key.slice(1))
}
