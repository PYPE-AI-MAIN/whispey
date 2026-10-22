// src/config/mcpAgentVoices.ts

/**
 * Curated, fixed voice allowlist for agents created/edited through the MCP.
 * Deliberately NOT the same source as Studio's own picker (MinimalVoicePicker.tsx),
 * which fetches ElevenLabs voices live from the account — MCP needs a stable,
 * explicit list to validate against server-side.
 */

export interface McpVoiceOption {
  provider: "elevenlabs" | "sarvam"
  voice_id: string
  name: string
  model: string
}

export const MCP_ELEVENLABS_VOICES: McpVoiceOption[] = [
  { provider: "elevenlabs", voice_id: "MmQVkVZnQ0dUbfWzcW6f", name: "Zara", model: "eleven_flash_v2_5" },
  { provider: "elevenlabs", voice_id: "ulZgFXalzbrnPUGQGs0S", name: "Vidya", model: "eleven_flash_v2_5" },
  { provider: "elevenlabs", voice_id: "pzxut4zZz4GImZNlqQ3H", name: "Raju", model: "eleven_flash_v2_5" },
  { provider: "elevenlabs", voice_id: "eA8FmgNe2rjMWPK5PQQZ", name: "Srikant", model: "eleven_flash_v2_5" },
]

// voice_id is the display id (what a client/MCP user sees and picks by);
// sarvamSpeaker is the real bulbul:v4-flash speaker string Sarvam's API
// actually expects — verified live against the API, since the plain names
// (shubh/priya/rahul/kavya) aren't valid speaker values on their own.
export const MCP_SARVAM_VOICES: (McpVoiceOption & { sarvamSpeaker: string })[] = [
  { provider: "sarvam", voice_id: "shubh", name: "Shubh", model: "bulbul:v4-flash", sarvamSpeaker: "shubh_enhi_companion" },
  { provider: "sarvam", voice_id: "priya", name: "Priya", model: "bulbul:v4-flash", sarvamSpeaker: "priya_hi_recovery" },
  { provider: "sarvam", voice_id: "rahul", name: "Rahul", model: "bulbul:v4-flash", sarvamSpeaker: "rahul_hi_conversational" },
  { provider: "sarvam", voice_id: "kavya", name: "Kavya", model: "bulbul:v4-flash", sarvamSpeaker: "kavya_hi_conversational" },
]

export const MCP_VOICES: McpVoiceOption[] = [...MCP_ELEVENLABS_VOICES, ...MCP_SARVAM_VOICES]

export function findMcpVoice(provider: string, voice_id: string): McpVoiceOption | undefined {
  return MCP_VOICES.find((v) => v.provider === provider && v.voice_id === voice_id)
}

/** Builds the `tts` block for an assistant config from a validated MCP voice selection. */
export function buildMcpTtsConfig(voice: McpVoiceOption) {
  if (voice.provider === "sarvam") {
    const sarvamSpeaker = (voice as (typeof MCP_SARVAM_VOICES)[number]).sarvamSpeaker
    return { name: "sarvam", provider: "sarvam", speaker: sarvamSpeaker, model: voice.model }
  }
  return { name: "elevenlabs", provider: "elevenlabs", voice_id: voice.voice_id, model: voice.model }
}
