/**
 * Which model Pi chat talks to. On Azure: gpt-5.6-luna first, and if that request fails, gpt-4.1-mini for
 * the rest of the turn. PI_MODEL / PI_FALLBACK_MODEL override either (Azure deployment names). These are
 * Pi-specific on purpose — AZURE_DEPLOYMENT_NAME is shared with other features and is left alone.
 * On plain OpenAI there is no Luna deployment, so it keeps AZURE_DEPLOYMENT_NAME / gpt-4o-mini with no fallback.
 */
type Env = Record<string, string | undefined>

/**
 * The Azure deployments a user may pick in the chat. The server only accepts a name from this list — the
 * request body is user-controlled, and an arbitrary deployment name would let anyone run any model on our key.
 * All five were checked to accept Pi's streamed tool-calling request.
 */
export const PI_MODEL_OPTIONS = [
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini-2', label: 'GPT-4.1 mini' },
] as const

export const DEFAULT_PI_MODEL = PI_MODEL_OPTIONS[0].id

export const isPiModelOption = (value: unknown): value is (typeof PI_MODEL_OPTIONS)[number]['id'] =>
  typeof value === 'string' && PI_MODEL_OPTIONS.some((o) => o.id === value)

export function piModels(env: Env, azure: boolean, requested?: unknown): { primary: string; fallback: string | null } {
  const picked = azure && isPiModelOption(requested) ? requested : null
  const primary = picked || env.PI_MODEL?.trim() || (azure ? DEFAULT_PI_MODEL : env.AZURE_DEPLOYMENT_NAME?.trim() || 'gpt-4o-mini')
  const fallback = env.PI_FALLBACK_MODEL?.trim() || (azure ? 'gpt-4.1-mini-2' : null)
  return { primary, fallback: fallback && fallback !== primary ? fallback : null }
}

/** gpt-5 / o-series reject `temperature` (only the default is allowed) and `max_tokens` (they take max_completion_tokens). */
export const isReasoningModel = (model: string) => /gpt-5|(^|[-/])o\d/i.test(model)

export const samplingFor = (model: string, temperature: number) => (isReasoningModel(model) ? {} : { temperature })
