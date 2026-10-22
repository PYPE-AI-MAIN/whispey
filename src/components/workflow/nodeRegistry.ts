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
    label: 'Conversation', icon: MessageSquare, color: '#8f4fc4', category: 'LLM',
    useCase: "The agent talks with the caller for one step, then moves on when it is done. Use it for most of the call.",
  },
  extract_variable: {
    label: 'Collect Details', icon: Variable, color: '#8b5cf6', category: 'LLM',
    useCase: 'Asks the caller for details, such as a name or a date, and remembers them. Moves on once it has them all.',
  },
  subagent: {
    label: 'Sub-Agent', icon: Bot, color: '#6366f1', category: 'LLM',
    useCase: 'A step with its own personality, voice and instructions, to hand the caller to a different character.',
  },
  logic_split: {
    label: 'Branch', icon: GitBranch, color: '#f59e0b', category: 'Control',
    useCase: 'Chooses the next step from something already collected, such as age under 18. Says nothing.',
  },
  function: {
    label: 'Call an API', icon: Globe, color: '#10b981', category: 'Control',
    useCase: 'Calls another system, such as a booking or CRM, and remembers the answer. Can be its own step or something a conversation step may use.',
  },
  code: {
    label: 'Code', icon: Code, color: '#64748b', category: 'Control',
    useCase: 'Runs a few lines of code on the collected details and remembers the result.',
  },
  mcp: {
    label: 'MCP Tool', icon: Server, color: '#06b6d4', category: 'Control',
    useCase: 'Uses a tool from a connected tool server and remembers what it returns.',
  },
  knowledge: {
    label: 'Knowledge', icon: BookOpen, color: '#ec4899', category: 'Control',
    useCase: "Looks something up in your uploaded documents. Most flows do not need it: turn on the knowledge base in Setup instead.",
  },
  call_transfer: {
    label: 'Call Transfer', icon: PhoneForwarded, color: '#ef4444', category: 'Telephony',
    useCase: 'Hands the call to a person. Phone calls only.',
  },
  press_digit: {
    label: 'Press Digit', icon: Hash, color: '#f97316', category: 'Telephony',
    useCase: 'Presses keys on a phone menu, or collects digits the caller types. Phone calls only.',
  },
  sms: {
    label: 'SMS', icon: MessageCircle, color: '#14b8a6', category: 'Telephony',
    useCase: 'Texts the caller during the call, for example a booking confirmation. Phone calls only.',
  },
  ending: {
    label: 'End Call', icon: CircleStop, color: '#dc2626', category: 'Terminal',
    useCase: 'Says a last line and hangs up. Every path should end at one of these.',
  },
  note: {
    label: 'Note', icon: StickyNote, color: '#a3a3a3', category: 'Utility',
    useCase: 'A sticky note for whoever edits this next. The agent never sees it.',
  },
}

export const CATEGORIES: NodeCategory[] = ['LLM', 'Control', 'Telephony', 'Terminal', 'Utility']

export function getNodesByCategory(category: NodeCategory): [NodeType, NodeMeta][] {
  return (Object.entries(NODE_REGISTRY) as [NodeType, NodeMeta][]).filter(([, m]) => m.category === category)
}
