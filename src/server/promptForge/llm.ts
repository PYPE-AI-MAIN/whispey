// Runs Prompt Forge chats on the same provider + model the real agent uses.
//
// Every provider the voice backend supports for LLMs speaks the OpenAI chat API
// (the backend itself reaches Sarvam, Cerebras etc. through the openai plugin),
// so one SDK covers them: only the base URL, key and model id differ. A
// provider is offered only when its key is configured on this server.
// AWS Bedrock and LiveKit Inference need their own SDKs and aren't wired yet.

import OpenAI, { AzureOpenAI } from 'openai'
import { modelProviders } from '@/config/llmCatalog'

interface ProviderSpec {
  /** Env var(s) holding the key; the first one set is used. */
  keys: string[]
  baseURL?: string
}

const OPENAI_COMPATIBLE: Record<string, ProviderSpec> = {
  openai: { keys: ['OPENAI_API_KEY'] },
  groq: { keys: ['GROQ_API_KEY'], baseURL: 'https://api.groq.com/openai/v1' },
  cerebras: { keys: ['CEREBRAS_API_KEY'], baseURL: 'https://api.cerebras.ai/v1' },
  sarvam: { keys: ['SARVAM_API_KEY'], baseURL: 'https://api.sarvam.ai/v1' },
  google: { keys: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'], baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' },
}

// same key the voice backend uses for self-hosted models (create_agent.py: api_key_env default)
const SELF_HOSTED_KEYS = ['GEMMA_LLM_API_KEY']

const NOT_YET: Record<string, string> = {
  aws: 'AWS Bedrock isn’t available in Prompt Forge yet',
  livekit: 'LiveKit Inference isn’t available in Prompt Forge yet',
}

const firstEnv = (names: string[]) => names.map((n) => process.env[n]?.trim()).find(Boolean)

/** Agent configs say `azure_openai`; workflow configs say `azure`. */
const normalize = (provider: string | null | undefined) => (provider === 'azure' ? 'azure_openai' : provider || 'openai')

/** Whether Prompt Forge can run this provider here, and why not. */
export function providerAvailability(provider: string): { available: boolean; reason?: string } {
  const p = normalize(provider)
  if (NOT_YET[p]) return { available: false, reason: NOT_YET[p] }
  if (p === 'azure_openai') {
    return process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT
      ? { available: true }
      : { available: false, reason: 'Azure OpenAI isn’t configured on this server' }
  }
  if (p === 'self_hosted') {
    return firstEnv(SELF_HOSTED_KEYS) ? { available: true } : { available: false, reason: 'No GEMMA_LLM_API_KEY configured on this server' }
  }
  const spec = OPENAI_COMPATIBLE[p]
  if (!spec) return { available: false, reason: `Unknown provider "${provider}"` }
  return firstEnv(spec.keys) ? { available: true } : { available: false, reason: `No ${spec.keys[0]} configured on this server` }
}

/** Availability for every provider in the Agent Config list. */
export function allProviderAvailability(): Record<string, { available: boolean; reason?: string }> {
  return Object.fromEntries(Object.keys(modelProviders).map((p) => [p, providerAvailability(p)]))
}

function catalogModel(provider: string, model: string) {
  const entry = modelProviders[provider]
  const models = entry?.type === 'grouped' ? entry.groups?.flatMap((g) => g.models) ?? [] : entry?.models ?? []
  return models.find((m) => m.value === model)
}

/** An OpenAI-API client and the model id to send, or why this provider/model can't run here. */
export function resolveForgeLlm(providerIn: string | null | undefined, modelIn: string | null | undefined): { client: OpenAI; model: string } | { error: string } {
  const provider = normalize(providerIn)
  const availability = providerAvailability(provider)
  if (!availability.available) return { error: availability.reason ?? 'Provider not available' }

  if (provider === 'azure_openai') {
    // Azure is addressed by deployment name, which can differ from the model
    // name (gpt-4.1-mini is deployed as gpt-4.1-mini-2).
    const model = modelIn || process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4.1-mini'
    return {
      client: new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.OPENAI_API_VERSION || '2024-12-01-preview',
      }),
      model: catalogModel('azure_openai', model)?.deploymentName || model,
    }
  }

  if (provider === 'self_hosted') {
    const entry = modelIn ? catalogModel('self_hosted', modelIn) : undefined
    // Only endpoints listed in the catalog — never a URL from the request.
    if (!entry?.baseUrl) return { error: 'Unknown self-hosted model' }
    return { client: new OpenAI({ apiKey: firstEnv(SELF_HOSTED_KEYS), baseURL: entry.baseUrl }), model: entry.value }
  }

  const spec = OPENAI_COMPATIBLE[provider]
  return {
    client: new OpenAI({ apiKey: firstEnv(spec.keys), ...(spec.baseURL ? { baseURL: spec.baseURL } : {}) }),
    model: modelIn || 'gpt-4o-mini',
  }
}
