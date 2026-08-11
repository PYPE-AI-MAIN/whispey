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
  /** One-line "reach for this when…", shown on palette hover. */
  useCase: string
}

export const NODE_REGISTRY: Record<NodeType, NodeMeta> = {
  conversation: {
    label: 'Conversation', icon: MessageSquare, color: '#3b82f6', category: 'LLM',
    useCase: "Speak and listen for one step. The LLM picks the next node from this one's edges. Cannot save variables — use Extract Variable for that.",
  },
  extract_variable: {
    label: 'Extract Variable', icon: Variable, color: '#8b5cf6', category: 'LLM',
    useCase: 'Ask the caller for named values and save them to state. Moves on the moment it has them all.',
  },
  subagent: {
    label: 'Sub-Agent', icon: Bot, color: '#6366f1', category: 'LLM',
    useCase: 'A Conversation step with its own persona, prompt and voice — for handing off to a different character.',
  },
  logic_split: {
    label: 'Logic Split', icon: GitBranch, color: '#f59e0b', category: 'Control',
    useCase: 'Branch on a variable expression, e.g. age < 18. Silent and deterministic — no LLM, nothing spoken.',
  },
  function: {
    label: 'HTTP Function', icon: Globe, color: '#10b981', category: 'Control',
    useCase: 'Call an API and save the response. Either a step in the flow, or attach it to a Conversation node so the LLM can call it as a tool.',
  },
  code: {
    label: 'Code', icon: Code, color: '#64748b', category: 'Control',
    useCase: 'Run a small Python or JavaScript snippet over the current variables and save the result.',
  },
  mcp: {
    label: 'MCP Tool', icon: Server, color: '#06b6d4', category: 'Control',
    useCase: 'Invoke a tool on an MCP server and save what it returns.',
  },
  knowledge: {
    label: 'Knowledge', icon: BookOpen, color: '#ec4899', category: 'Control',
    useCase: "Search the knowledge base and inject the matches into the agent's context for the next turn.",
  },
  call_transfer: {
    label: 'Call Transfer', icon: PhoneForwarded, color: '#ef4444', category: 'Telephony',
    useCase: 'Hand the call to a human. Cold drops the agent out; warm keeps it in the conference. Needs the telephony transport.',
  },
  press_digit: {
    label: 'Press Digit', icon: Hash, color: '#f97316', category: 'Telephony',
    useCase: 'Send DTMF tones to an IVR, or collect digits the caller keys in. Needs the telephony transport.',
  },
  sms: {
    label: 'SMS', icon: MessageCircle, color: '#14b8a6', category: 'Telephony',
    useCase: 'Text the caller mid-call, e.g. a booking confirmation. Needs the telephony transport.',
  },
  ending: {
    label: 'End Call', icon: CircleStop, color: '#dc2626', category: 'Terminal',
    useCase: 'Say one last line and hang up. Every path should finish here.',
  },
  note: {
    label: 'Note', icon: StickyNote, color: '#a3a3a3', category: 'Utility',
    useCase: 'A comment pinned to the canvas for whoever edits this next. Never runs.',
  },
}

export const CATEGORIES: NodeCategory[] = ['LLM', 'Control', 'Telephony', 'Terminal', 'Utility']

export function getNodesByCategory(category: NodeCategory): [NodeType, NodeMeta][] {
  return (Object.entries(NODE_REGISTRY) as [NodeType, NodeMeta][]).filter(([, m]) => m.category === category)
}
