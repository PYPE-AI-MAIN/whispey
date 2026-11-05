import { useQuery } from '@tanstack/react-query'

export interface AwayDefaultPrompt {
  prompt: string
  max_chars: number
}

async function fetchAwayDefaultPrompt(): Promise<AwayDefaultPrompt> {
  const res = await fetch('/api/away-prompt/default')
  const body = await res.json().catch(() => null)
  if (!res.ok || typeof body?.prompt !== 'string') {
    throw new Error(body?.error || "Couldn't load the default prompt")
  }
  return {
    prompt: body.prompt,
    max_chars: Number.isFinite(body.max_chars) && body.max_chars > 0 ? body.max_chars : 6000,
  }
}

/** The backend's built-in prompt for dynamic away messages. Fetched only while `enabled`; cached for 5 minutes. */
export function useAwayDefaultPrompt(enabled: boolean) {
  return useQuery({
    queryKey: ['away-default-prompt'],
    queryFn: fetchAwayDefaultPrompt,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
