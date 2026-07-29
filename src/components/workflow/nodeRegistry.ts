import {
  MessageSquare,
  Variable,
  GitBranch,
  Globe,
  BookOpen,
  PhoneForwarded,
  Hash,
  MessageCircle,
  Bot,
  Server,
  Code,
  CircleStop,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'
import type { NodeType } from '@/lib/workflow/schema'

export type NodeCategory = 'LLM' | 'Control' | 'Telephony' | 'Terminal' | 'Utility'

export interface NodeMeta {
  label: string
  icon: LucideIcon
  color: string
  category: NodeCategory
}

export const NODE_REGISTRY: Record<NodeType, NodeMeta> = {
  conversation: { label: 'Conversation', icon: MessageSquare, color: '#3b82f6', category: 'LLM' },
  extract_variable: { label: 'Extract Variable', icon: Variable, color: '#8b5cf6', category: 'LLM' },
  subagent: { label: 'Sub-Agent', icon: Bot, color: '#6366f1', category: 'LLM' },
  logic_split: { label: 'Logic Split', icon: GitBranch, color: '#f59e0b', category: 'Control' },
  function: { label: 'HTTP Function', icon: Globe, color: '#10b981', category: 'Control' },
  code: { label: 'Code', icon: Code, color: '#64748b', category: 'Control' },
  mcp: { label: 'MCP Tool', icon: Server, color: '#06b6d4', category: 'Control' },
  knowledge: { label: 'Knowledge', icon: BookOpen, color: '#ec4899', category: 'Control' },
  call_transfer: { label: 'Call Transfer', icon: PhoneForwarded, color: '#ef4444', category: 'Telephony' },
  press_digit: { label: 'Press Digit', icon: Hash, color: '#f97316', category: 'Telephony' },
  sms: { label: 'SMS', icon: MessageCircle, color: '#14b8a6', category: 'Telephony' },
  ending: { label: 'End Call', icon: CircleStop, color: '#dc2626', category: 'Terminal' },
  note: { label: 'Note', icon: StickyNote, color: '#a3a3a3', category: 'Utility' },
}

export const CATEGORIES: NodeCategory[] = ['LLM', 'Control', 'Telephony', 'Terminal', 'Utility']

export function getNodesByCategory(category: NodeCategory): [NodeType, NodeMeta][] {
  return (Object.entries(NODE_REGISTRY) as [NodeType, NodeMeta][]).filter(([, m]) => m.category === category)
}
