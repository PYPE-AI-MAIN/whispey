// src/config/mcpAgentDefaults.ts

/**
 * Default agent configuration for agents created through the MCP.
 * Deliberately a separate object from AGENT_DEFAULT_CONFIG (src/config/agentDefaults.ts)
 * — starts as a clone of it, but is meant to be tuned independently over time
 * for MCP-created agents without affecting the dashboard's own defaults.
 */

export const MCP_AGENT_DEFAULT_CONFIG = {
  stt: {
    name: "sarvam",
    provider: "sarvam",
    language: "unknown", // "unknown" is Saaras's literal auto-detect sentinel, not "auto"
    model: "saaras:v4",
    mode: "transcribe",
    config: {}
  },

  llm: {
    name: "azure_openai",
    provider: "azure",
    model: "gpt-4.1-mini",
    temperature: 0.3,
    azure_deployment: "gpt-4.1-mini-2",
    azure_endpoint: "https://pype-azure-openai.cognitiveservices.azure.com/",
    api_version: "2024-12-01-preview",
    api_key_env: "AZURE_OPENAI_API_KEY"
  },

  vad: {
    name: "silero",
    min_silence_duration: 0.55,
    min_speech_duration: 0.05,
    prefix_padding_duration: 0.5,
    max_buffered_speech: 60,
    activation_threshold: 0.5,
    sample_rate: 16000,
    force_cpu: true
  },

  interruptions: {
    allow_interruptions: true,
    min_interruption_duration: 0.8,
    min_interruption_words: 0,
    drop_filler_words: false,
    filler_drop_list: [] as string[]
  },

  first_message_mode: {
    mode: "assistant_speaks_first",
    first_message: "Hello! How can I help you today?",
    allow_interruptions: false
  },

  session_behavior: {
    preemptive_generation: "disabled",
    turn_detection: "disabled",
    unlikely_threshold: 0.6,
    min_endpointing_delay: 0.7,
    max_endpointing_delay: 0.7,
    endpointing_mode: null as string | null,
    interruption_mode: null as string | null,
    user_away_timeout: undefined as number | undefined,
    user_away_timeout_message: undefined as string | undefined,
    user_away_timeout_max_count: undefined as number | undefined,
    user_away_timeout_end_message: undefined as string | undefined
  },

  background_audio: {
    enabled: true,
    ambient: { type: "office", volume: 5 },
    thinking: { type: "keyboard", volume: 0.5 },
    thinking_probability: 0.1,
    tool_call_typing_config: { enabled: true, volume: 0.8 }
  },

  tools: [] as Array<{ type: string }>,

  filler_words: {
    enabled: true,
    question_keywords: [] as string[],
    question_fillers: [] as string[],
    ambiguous_keywords: [] as string[],
    ambiguous_fillers: [] as string[],
    general_fillers: [] as string[],
    conversation_fillers: [] as string[],
    conversation_keywords: [] as string[]
  },

  bug_reports: {
    enable: false,
    bug_start_command: [] as string[],
    bug_end_command: [] as string[],
    response: "",
    collection_prompt: ""
  },

  context_memory: {
    enabled: false
  }
}
