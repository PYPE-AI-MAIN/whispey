// The LLM providers and models Agent Config offers. Plain data so the model
// picker, Prompt Forge and server routes all share one list (Prompt Forge must
// run the same models the real agent uses).

export interface Model {
  value: string
  label: string
  id?: string
  deploymentName?: string
  // Per-model OpenAI-compatible endpoint override (self-hosted / custom providers).
  // When absent, the backend falls back to the provider's default env-configured base_url.
  baseUrl?: string
  addedAt?: string // ISO date (YYYY-MM-DD); shows a "New" badge for NEW_BADGE_DAYS after this date
}

export interface ModelGroup {
  name: string
  models: Model[]
}

export interface Provider {
  label: string
  icon: string
  color: string
  type: 'direct' | 'config' | 'grouped'
  models?: Model[]
  groups?: ModelGroup[]
  description?: string
  addedAt?: string // ISO date (YYYY-MM-DD); shows a "New" badge for NEW_BADGE_DAYS after this date
}

// LiveKit Inference model catalogue: [groupName, [[value, label, addedAt?], ...]].
// Gemma 4 31B is LiveKit's own latency-tuned deployment (SGLang + speculative
// decoding) and the reason this provider is worth having. gpt-oss-120b is
// deliberately absent: it spends its whole completion budget on reasoning_content
// before the first speakable token, so its effective TTFT for voice is far worse
// than its headline.
const LIVEKIT_GROUPS: [string, [string, string, string?][]][] = [
  ['Latency optimized', [
    ['google/gemma-4-31b-it', 'Gemma 4 31B', '2026-09-11'],
  ]],
  ['Fast', [
    ['google/gemini-3-flash', 'Gemini 3 Flash'],
    ['google/gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite'],
    ['google/gemini-2.5-flash', 'Gemini 2.5 Flash'],
    ['openai/gpt-4.1-mini', 'GPT 4.1 Mini'],
    ['openai/gpt-4.1-nano', 'GPT 4.1 Nano'],
    ['xai/grok-4-1-fast-non-reasoning', 'Grok 4.1 Fast'],
  ]],
  ['Frontier', [
    ['openai/gpt-5.5', 'GPT 5.5'],
    ['openai/gpt-5.4-mini', 'GPT 5.4 Mini'],
    ['google/gemini-3.1-pro', 'Gemini 3.1 Pro'],
    ['moonshotai/kimi-k2.6', 'Kimi K2.6'],
    ['zai/glm-5.1', 'Z.ai GLM 5.1'],
    ['deepseek-ai/deepseek-v3.2', 'DeepSeek V3.2'],
  ]],
]

export const modelProviders: Record<string, Provider> = {
  openai: {
    label: 'OpenAI',
    icon: 'O',
    color: 'bg-emerald-500',
    type: 'direct',
    models: [
      { value: 'gpt-5.6-luna', label: 'GPT 5.6 Luna' },
      { value: 'gpt-5', label: 'GPT 5' },
      { value: 'gpt-5-mini', label: 'GPT 5 Mini' },
      { value: 'gpt-5-nano', label: 'GPT 5 Nano' },
      { value: 'gpt-4.1', label: 'GPT 4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT 4.1 Mini' },
      { value: 'gpt-4.1-nano', label: 'GPT 4.1 Nano' },
      { value: 'gpt-4o', label: 'GPT 4o' },
      { value: 'gpt-4o-mini', label: 'GPT 4o Mini' },
    ]
  },
  sarvam: {
    label: 'Sarvam',
    icon: 'S',
    color: 'bg-rose-500',
    type: 'direct',
    addedAt: '2026-09-02',
    models: [
      // Only Sarvam's currently-live models; the 30b/32k/m variants are
      // deprecated server-side (400 "model has been deprecated").
      { value: 'sarvam-105b-conversations', label: 'Sarvam 105B Conversations', addedAt: '2026-09-02' },
      { value: 'sarvam-105b', label: 'Sarvam 105B' },
    ]
  },
  google: {
    label: 'Google',
    icon: 'G',
    color: 'bg-blue-500',
    type: 'direct',
    addedAt: '2026-07-22',
    models: [
      { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
      { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', addedAt: '2026-07-22' },
      { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-lite', addedAt: '2026-07-22' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-preview-09-2025', label: 'Gemini 2.5 Flash Preview' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-lite' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-lite' },
    ]
  },
  azure_openai: {
    label: 'Azure OpenAI',
    icon: 'Az',
    color: 'bg-blue-500',
    type: 'config',
    models: [
      { value: 'gpt-5.6-terra', label: 'GPT 5.6 Terra', deploymentName: 'gpt-5.6-terra' },
      { value: 'gpt-5.6-luna', label: 'GPT 5.6 Luna', deploymentName: 'gpt-5.6-luna' },
      { value: 'gpt-4.1-mini', label: 'GPT 4.1 Mini', deploymentName: 'gpt-4.1-mini-2' },
    ]
  },
  aws: {
    label: 'AWS Bedrock',
    icon: 'Aw',
    color: 'bg-gray-500',
    type: 'direct',
    models: [
      { value: 'zai.glm-5', label: 'Z.ai GLM 5' },
      { value: 'in.openai.gpt-5.6-luna', label: 'OpenAI GPT 5.6 Luna', addedAt: '2026-08-18' },
      { value: 'in.openai.gpt-5.6-terra', label: 'OpenAI GPT 5.6 Terra', addedAt: '2026-08-18' }
    ]
  },
  groq: {
    label: 'Groq',
    icon: 'G',
    color: 'bg-blue-500',
    type: 'grouped',
    groups: [
      {
        name: 'Featured Systems',
        models: [
          { value: 'groq/compound', label: 'Groq Compound' },
        ]
      },
      {
        name: 'Production Models',
        models: [
          { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
          { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
          { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
          { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
        ]
      },
      {
        name: 'Preview Models',
        models: [
          { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B 128E' },
          { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B 16E' },
          { value: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2 0905' },
          { value: 'openai/gpt-oss-safeguard-20b', label: 'Safety GPT-OSS 20B' },
          { value: 'qwen/qwen3-32b', label: 'Qwen3-32B' },
        ]
      }
    ]
  },
  cerebras: {
    label: 'Cerebras',
    icon: 'C',
    color: 'bg-blue-500',
    type: 'grouped',
    groups: [
      {
        name: 'Production Models',
        models: [
          { value: 'llama3.1-8b', label: 'Llama 3.1 8B' },
          { value: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
          { value: 'gpt-oss-120b', label: 'OpenAI GPT-OSS 120B' },
          { value: 'qwen-3-32b', label: 'Qwen 3 32B' },
        ]
      },
      {
        name: 'Preview Models',
        models: [
          { value: 'qwen-3-235b-a22b-instruct-2507', label: 'Qwen 3 235B Instruct' },
          { value: 'qwen-3-235b-a22b-thinking-2507', label: 'Qwen 3 235B Thinking' },
          { value: 'zai-glm-4.6', label: 'Z.ai GLM 4.6' },
        ]
      }
    ]
  },
  // LiveKit Inference — served through LiveKit Cloud's own gateway and authed with
  // the worker's existing LIVEKIT_API_KEY/SECRET, so there is no key to configure
  // and no per-provider plugin. Model ids are namespaced `vendor/model` and are
  // passed through to the gateway verbatim.
  //
  // Listed as [value, label] tuples rather than { value, label } object literals:
  // after Sonar's CPD normalizes string literals, a run of object literals here is
  // token-identical to the equally long runs in the Groq/OpenAI lists above and gets
  // flagged as a clone. Tuples halve the tokens per line, so the same run stays
  // under the duplication threshold.
  livekit: {
    label: 'LiveKit Inference',
    icon: 'LK',
    color: 'bg-gray-500',
    type: 'grouped',
    description: 'Gateway-served models, billed via LiveKit Cloud. No API key needed.',
    addedAt: '2026-09-11',
    groups: LIVEKIT_GROUPS.map(([name, entries]) => ({
      name,
      models: entries.map(([value, label, addedAt]) => ({ value, label, addedAt })),
    })),
  },
  self_hosted: {
    label: 'Self-Hosted',
    icon: 'S',
    color: 'bg-slate-600',
    type: 'grouped',
    description: 'Custom OpenAI-compatible endpoints',
    addedAt: '2026-09-14',
    groups: [
      {
        name: 'Custom Endpoints',
        models: [
          {
            // gemma4-e4b-mtp: int4 QAT + multi-token-prediction drafter (speculative
            // decoding), ~2x the decode speed of the plain gemma4:e4b-it-qat tag also
            // hosted on this box. Use this one -- per the box owner's runbook
            // (GEMMA-ENDPOINT.md, Ashish, verified 14 Sep 2026), gemma4:e4b-it-qat is
            // explicitly the slower baseline kept only for comparison.
            value: 'gemma4-e4b-mtp',
            label: 'Gemma 4 E4B (MTP)',
            baseUrl: 'https://llm-13-207-31-49.sslip.io/v1',
            addedAt: '2026-09-14',
          },
        ]
      }
    ]
  }
}

// Looks up the configured base_url for a self-hosted / custom-endpoint model.
// Returns undefined for any model that doesn't declare one (direct SDK providers
// like OpenAI/Google never need this) — callers should fall back to a server-side
// default env var in that case rather than send an empty string.
export function getModelBaseUrl(providerKey: string, modelValue: string): string | undefined {
  const provider = modelProviders[providerKey]
  if (!provider) return undefined
  const allModels = provider.type === 'grouped'
    ? provider.groups?.flatMap(g => g.models) ?? []
    : provider.models ?? []
  return allModels.find(m => m.value === modelValue)?.baseUrl
}

