// Azure deployments an agent's field extractor can run on. The analytics
// lambda keeps the same list (services/transcript/transcriptProcessor.mjs);
// anything not listed there falls back to its default, so keep them in step.

export interface FieldExtractorModel {
  /** Azure deployment name, stored in pype_voice_agents.field_extractor_model. */
  value: string
  label: string
  beta?: boolean
}

/** What extraction runs on when an agent hasn't picked one (column left empty). */
export const DEFAULT_FIELD_EXTRACTOR_MODEL = 'gpt-4.1-mini-2'

export const FIELD_EXTRACTOR_MODELS: FieldExtractorModel[] = [
  { value: DEFAULT_FIELD_EXTRACTOR_MODEL, label: 'GPT-4.1 mini' },
  { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', beta: true },
  { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', beta: true },
]

export function isFieldExtractorModel(value: unknown): value is string {
  return typeof value === 'string' && FIELD_EXTRACTOR_MODELS.some((m) => m.value === value)
}

/** The stored value for a choice: null for the default, so the column stays empty. */
export function storedFieldExtractorModel(value: string): string | null {
  return value === DEFAULT_FIELD_EXTRACTOR_MODEL ? null : value
}

/** The PATCH fields for a model choice: nothing when it didn't change. */
export function modelChange(saved: string | null | undefined, picked: string): { field_extractor_model?: string | null } {
  const next = storedFieldExtractorModel(picked)
  return next === (saved ?? null) ? {} : { field_extractor_model: next }
}
