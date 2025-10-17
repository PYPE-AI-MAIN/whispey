// src/app/[projectid]/agents/[agentid]/config/page.tsx
export const plivoRate = 0.70;

export const blacklistedEmails = [
  "da76780@gmail.com",
  "deepesh@pypeai.com",
  "adarsh@pypeai.com",
  "ashish@pypeai.com",
  "dhruv@pypeai.com",
  "suryadipta@pypeai.com",
  "abhinav@pypeai.com",
  "friends@pypeai.com",
  "agrawaldeepesh546@gmail.com",
  "mihirvt@gmail.com",
  "test@pypeai.com",
  "asmin.m@quantana.in"
];


// Agent Config Constants
export const modelOptions = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
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
  { value: 'user_speaks_first', label: 'User speaks first' },
  { value: 'assistant_speaks_first', label: 'Assistant speaks first' },
  { value: 'assistant_speaks_with_generated', label: 'Assistant with generated message' },
]