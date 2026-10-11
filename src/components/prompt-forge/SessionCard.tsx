// A Prompt Forge session as the sessions list sees it, and how its row is described.
import { modelProviders } from '@/config/llmCatalog'

export interface Session {
  id: string
  name: string
  messages: any[]
  system_prompt: string
  model: string | null
  provider: string | null
  created_at: string
  updated_at: string
  /** Who created it (null for sessions from before owners were recorded). */
  owner_email?: string | null
  /** The caller can rename/delete/save it — their own, or unowned. */
  can_edit?: boolean
  is_mine?: boolean
  version_count?: number
}

const UNTITLED = /^untitled session$/i

/** A readable title: the session's name, or the prompt's own first heading/line when it was never named. */
export function sessionTitle(s: Session): { title: string; fromPrompt: boolean } {
  if (s.name && !UNTITLED.test(s.name.trim())) return { title: s.name, fromPrompt: false }
  const line = (s.system_prompt ?? '').split('\n').map(l => l.replace(/^#+\s*/, '').trim()).find(Boolean)
  return line ? { title: line.length > 70 ? `${line.slice(0, 70)}…` : line, fromPrompt: true } : { title: 'Untitled session', fromPrompt: false }
}

export function modelName(provider: string | null, model: string | null): string {
  if (!model) return 'Agent’s model'
  const entry = provider ? modelProviders[provider === 'azure' ? 'azure_openai' : provider] : undefined
  const grouped = entry?.type === 'grouped'
  const models = (grouped ? entry.groups?.flatMap(g => g.models) : entry?.models) ?? []
  return models.find(m => m.value === model)?.label ?? model
}

/** The last thing said in the session's chat, for a one-line preview. */
export function lastMessage(s: Session): { who: string; text: string } | null {
  const m = [...(s.messages ?? [])].reverse().find((x: any) => typeof x?.content === 'string' && x.content.trim())
  return m ? { who: m.role === 'user' ? 'You' : 'Agent', text: m.content.trim().replaceAll(/\s+/g, ' ') } : null
}


export function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

export function formatAbsolute(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
