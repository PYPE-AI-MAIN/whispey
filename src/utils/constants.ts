// src/app/[projectid]/agents/[agentid]/config/page.tsx
export const plivoRate = 0.70;

// Agent Config Constants
export const modelOptions = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "azure_openai", label: "Azure OpenAI" },
  { value: "groq", label: "Groq" },
  { value: "cerebras", label: "Cerebras" },
]

export const languageOptions = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "multilingual", label: "Multilingual" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" }
]

export const firstMessageModes = [
  { value: 'assistant_waits_for_user', label: 'User speaks first' },
  { value: 'assistant_speaks_first', label: 'Assistant speaks first' },
  { value: 'assistant_speaks_with_generated', label: 'Assistant with generated message' },
]