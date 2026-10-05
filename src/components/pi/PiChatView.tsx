'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowUp, Mic } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useVoiceAgent } from '@/hooks/useVoiceAgent'
import PiCustomToolForm, { type ToolDraft } from '@/components/pi/PiCustomToolForm'

const MARKDOWN_COMPONENTS = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-[15px] font-medium text-gray-900 dark:text-gray-100 mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="whitespace-pre-wrap text-[15px] leading-7 text-gray-800 dark:text-gray-200 not-first:mt-3">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className={`block overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 ${className ?? ''}`}>
          {children}
        </code>
      )
    }
    return (
      <code className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[13px] text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
        {children}
      </code>
    )
  },
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="not-first:mt-3 overflow-x-auto">{children}</pre>,
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-5 space-y-2 text-[15px] leading-7 text-gray-800 dark:text-gray-200 not-first:mt-3">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-5 space-y-2 text-[15px] leading-7 text-gray-800 dark:text-gray-200 not-first:mt-3">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-gray-300 pl-3 not-first:mt-3 text-gray-600 dark:border-gray-600 dark:text-gray-400">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-gray-200 dark:border-gray-800" />,
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    href?.startsWith('/') && !href.startsWith('//')
      // new tab for a link Pi drops inline (e.g. naming an agent) — clicking
      // it shouldn't navigate away from the chat you're in the middle of
      ? <Link href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">{children}</Link>
      : <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">{children}</a>
  ),
}

export interface ToolCall {
  id: string
  name: string
  arguments: any
  result?: any
  success?: boolean
  pending?: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isFinal: boolean
  toolCalls?: ToolCall[]
}

const TOOL_LABELS: Record<string, string> = {
  list_agents: 'Checking your agents',
  get_agent_details: 'Reading agent config',
  list_analytics_fields: 'Looking up available fields',
  get_call_volume_trend: 'Pulling call volume',
  get_completion_insights: 'Analyzing completion rates',
  query_analytics: 'Running analytics',
  get_talk_link: 'Setting up test call',
  create_agent: 'Creating the agent',
  edit_agent: 'Updating the agent',
  open_custom_tool_form: 'Opening tool form',
  open_page: 'Opening page',
  list_phone_numbers: 'Checking phone numbers',
  search_plivo_numbers: 'Searching Plivo numbers',
  buy_plivo_number: 'Buying the number',
  attach_inbound_number: 'Attaching the number',
}

const THINKING_PHRASES = ['Thinking', 'Still working on it', 'Putting the answer together']

const SUGGESTIONS = [
  'How is call volume trending over the last 30 days?',
  'Which agent handled the most calls, and how did they perform?',
  'Walk me through what happens when you create a new voice agent here.',
  'Attach an inbound phone number to one of my agents.',
]


// Pure CSS — no animation library needed for a decorative loading orb.
// Several large, softly-blurred radial gradients drift against each other to
// read as one glossy, shifting sphere, the same trick behind most "AI is
// thinking" orbs — no WebGL/Three.js/Lottie asset required.
function ThinkingOrb() {
  return (
    <span className="pi-orb" aria-hidden="true">
      <style jsx>{`
        .pi-orb {
          display: inline-block;
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 0 6px 1px rgba(56, 189, 248, 0.35);
          animation: pi-orb-pulse 2.4s ease-in-out infinite;
        }
        .pi-orb::before {
          content: '';
          display: block;
          width: 100%;
          height: 100%;
          border-radius: inherit;
          background:
            radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), transparent 45%),
            radial-gradient(circle at 65% 70%, #7dd3fc 0%, transparent 55%),
            radial-gradient(circle at 70% 25%, #38bdf8 0%, transparent 60%),
            radial-gradient(circle at 25% 70%, #1e3a8a 0%, #0c1b3a 70%);
          animation: pi-orb-spin 3s linear infinite;
        }
        @keyframes pi-orb-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pi-orb-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </span>
  )
}

function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setPhraseIndex((i) => Math.min(i + 1, THINKING_PHRASES.length - 1)), 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="inline-flex items-center gap-2 py-2 text-[13px] text-gray-400 dark:text-gray-500">
      <ThinkingOrb />
      {THINKING_PHRASES[phraseIndex]}
    </span>
  )
}

function voiceTarget(tc: ToolCall): { agentName: string; label: string } | null {
  if (tc.success === false || tc.pending) return null
  if (tc.name === 'create_agent' && tc.result?.name) {
    return { agentName: String(tc.result.name), label: String(tc.result.display_name ?? 'Agent') }
  }
  if ((tc.name === 'get_talk_link' || tc.name === 'edit_agent') && tc.result?.backend_name) {
    return { agentName: String(tc.result.backend_name), label: String(tc.result.display_name ?? 'Agent') }
  }
  return null
}

function pageTarget(tc: ToolCall): { href: string; label: string } | null {
  if (tc.name !== 'open_page' || tc.success === false || tc.pending || typeof tc.result?.href !== 'string') return null
  if (!tc.result.href.startsWith('/')) return null
  return { href: tc.result.href, label: String(tc.result.label || 'Open page') }
}

function toolForm(tc: ToolCall): { agentId: string; label: string; draft: ToolDraft } | null {
  if (tc.name !== 'open_custom_tool_form' || tc.success === false || tc.pending || !tc.result?.show_form) return null
  return {
    agentId: String(tc.result.agent_id),
    label: String(tc.result.display_name ?? 'this agent'),
    draft: (tc.result.draft ?? {}) as ToolDraft,
  }
}

// A list_agents call with 2+ agents is almost always followed by Pi asking
// which one the user means — a clickable picker beats typing the name back
function agentSelector(tc: ToolCall): Array<{ id: string; display_name: string }> | null {
  if (tc.name !== 'list_agents' || tc.success === false || tc.pending) return null
  const agents = tc.result?.agents
  if (!Array.isArray(agents) || agents.length < 2) return null
  return agents.map((a: any) => ({ id: String(a.id), display_name: String(a.display_name ?? 'Agent') }))
}

// create_agent/edit_agent never execute server-side until a button click (see
// route.ts) — this reads the __pending marker and builds the human-readable
// summary for what that click will actually do.
function composeInput(recording: boolean, partialText: string, input: string): string {
  if (!recording || !partialText) return input
  return input ? `${input} ${partialText}` : partialText
}

function usageBarColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  return pct >= 70 ? 'bg-amber-500' : 'bg-gray-500'
}

const CONFIRMED_TOOLS = new Set(['create_agent', 'edit_agent', 'buy_plivo_number', 'attach_inbound_number'])

function buySummary(pv: any, args: any): string {
  if (!pv?.monthly_usd) return `Buy ${args.number ?? 'this number'} — price could not be confirmed, it may no longer be available.`
  const where = pv.city ? ` (${pv.city})` : ''
  const setup = Number(pv.setup_usd) ? ` + $${Number(pv.setup_usd).toFixed(2)} setup` : ''
  return `Buy ${pv.number}${where} for $${Number(pv.monthly_usd).toFixed(2)}/month${setup}. This charges your Plivo account.`
}

function attachSummary(pv: any, args: any): string {
  if (!pv?.agent) return `Attach ${args.number ?? 'this number'} for inbound calls.`
  return `Attach ${pv.number} to "${pv.agent}" for inbound calls, named ${pv.alias}.`
}

function dispositionsSummary(args: any): string {
  const verb = args.dispositions_mode === 'replace' ? 'replace all dispositions with' : 'add/update'
  const plural = args.dispositions.length === 1 ? '' : 's'
  return `${verb} ${args.dispositions.length} disposition${plural} (${args.dispositions.map((d: any) => d.key).join(', ')})`
}

function editSummary(args: any): string {
  const parts: string[] = []
  if (args.prompt !== undefined) parts.push('replace the prompt')
  if (args.prompt_patch) parts.push('edit part of the prompt')
  if (args.greeting !== undefined) parts.push('change the greeting')
  if (args.voice_provider && args.voice_id) parts.push(`change the voice to ${args.voice_id}`)
  if (args.llm_model !== undefined) parts.push(`change the LLM to ${args.llm_model}`)
  if (args.variables !== undefined) parts.push('update prompt variables')
  if (args.extractor_variables !== undefined) parts.push('update extractor variables')
  if (Array.isArray(args.dispositions)) parts.push(dispositionsSummary(args))
  return parts.length ? `Update this agent: ${parts.join(', ')}` : 'Update this agent'
}

function pendingAction(tc: ToolCall): { action: string; summary: string } | null {
  if (!CONFIRMED_TOOLS.has(tc.name) || !tc.result?.__pending) return null
  const args = tc.arguments ?? {}
  const pv = tc.result?.preview
  if (tc.name === 'buy_plivo_number') return { action: tc.name, summary: buySummary(pv, args) }
  if (tc.name === 'attach_inbound_number') return { action: tc.name, summary: attachSummary(pv, args) }
  if (tc.name === 'create_agent') return { action: tc.name, summary: `Create a new agent named "${args.display_name ?? args.name ?? 'Untitled'}"` }
  return { action: tc.name, summary: editSummary(args) }
}

const CALL_STATE: Record<string, string> = {
  initializing: 'Waiting for the agent…',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
}

function pickLevel(speaking: boolean, active: boolean, whenSpeaking: number, whenActive: number, idle: number): number {
  if (speaking) return whenSpeaking
  return active ? whenActive : idle
}

function SoundBars({ active, speaking }: Readonly<{ active: boolean; speaking: boolean }>) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), active ? 120 : 700)
    return () => clearInterval(id)
  }, [active])
  const spread = pickLevel(speaking, active, 0.55, 0.22, 0.08)
  const base = pickLevel(speaking, active, 0.7, 0.35, 0.18)
  return (
    <div className="flex h-10 items-center justify-center gap-1" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => {
        const wobble = (Math.sin(tick * 0.9 + i * 1.3) + Math.sin(tick * 0.37 + i * 2.1)) / 2
        const level = Math.max(0.15, Math.min(1, base + wobble * spread))
        return (
          <span
            key={i}
            className={`w-1 rounded-full transition-[height] duration-150 ${speaking ? 'bg-blue-500' : 'bg-gray-400 dark:bg-gray-500'}`}
            style={{ height: `${Math.round(level * 40)}px` }}
          />
        )
      })}
    </div>
  )
}

function PiVoiceCall({ agentName, label }: Readonly<{ agentName: string; label: string }>) {
  const [state, actions] = useVoiceAgent({ agentName, mode: 'voice' })
  const live = state.isConnected
  const speaking = state.agentState === 'speaking'
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <span className="text-[12px] text-gray-400">{live ? CALL_STATE[state.agentState] ?? state.agentState : 'Not on a call'}</span>
      </div>
      <SoundBars active={live || state.isConnecting} speaking={speaking} />
      {live && state.transcripts.length > 0 && (
        <div className="mb-2 max-h-36 space-y-1.5 overflow-y-auto">
          {state.transcripts.slice(-6).map((t) => (
            <p key={t.id} className={`text-[13px] leading-5 ${t.speaker === 'user' ? 'text-right text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
              {t.text}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {live ? (
          <>
            <button type="button" onClick={() => void actions.toggleMute()} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              {state.isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" onClick={() => void actions.disconnect()} className="rounded-lg bg-gray-900 px-3 py-1.5 text-[13px] text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900">
              Stop
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={state.isConnecting}
            onClick={() => void actions.connect()}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-[13px] text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
          >
            {state.isConnecting ? 'Starting…' : 'Start agent'}
          </button>
        )}
      </div>
      {state.connectionError && <p className="mt-2 text-[12px] text-red-600 dark:text-red-400">{state.connectionError}</p>}
    </div>
  )
}

const COLLAPSED_MESSAGE_LINES = 8
const LINE_HEIGHT_PX = 28 // matches `leading-7`

function UserMessage({ content }: Readonly<{ content: string }>) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    // measured while unclamped (collapsed starts false), so scrollHeight is the natural full height
    setOverflows(el.scrollHeight > COLLAPSED_MESSAGE_LINES * LINE_HEIGHT_PX + 4)
  }, [content])

  const collapsed = overflows && !open

  return (
    <div className="relative max-w-[85%] rounded-2xl bg-white px-4 py-3 text-[15px] leading-7 text-gray-900 shadow-sm ring-1 ring-gray-200/80 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800">
      <div
        ref={bodyRef}
        className="whitespace-pre-wrap break-words overflow-hidden"
        style={collapsed ? { display: '-webkit-box', WebkitLineClamp: COLLAPSED_MESSAGE_LINES, WebkitBoxOrient: 'vertical' } : undefined}
      >
        {content}
      </div>
      {overflows && (
        <div className={collapsed
          ? 'absolute inset-x-0 bottom-0 flex h-14 items-end justify-end rounded-b-2xl bg-gradient-to-t from-white via-white to-transparent px-3 pb-2 dark:from-gray-900 dark:via-gray-900'
          : 'mt-1 flex justify-end'}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[13px] font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {open ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  )
}

function ToolCallLine({ tc }: Readonly<{ tc: ToolCall }>) {
  const label = TOOL_LABELS[tc.name] ?? tc.name
  if (tc.pending) {
    return <span className="text-[12px] text-gray-400 dark:text-gray-500">{label}…</span>
  }
  if (tc.success === false) {
    return <span className="text-[12px] text-red-600 dark:text-red-400">{label} failed</span>
  }
  return <span className="text-[12px] text-gray-400 dark:text-gray-500">{label}</span>
}

// --- Smooth streaming -------------------------------------------------------
// Network chunks arrive in bursts; showing them as-is looks jumpy. Text is
// revealed on requestAnimationFrame at a speed that scales with the backlog
// (steady when small, fast enough to never lag far behind), never splitting a
// surrogate pair or a combining mark (Devanagari/Kannada conjuncts).
const COMBINING = /[\p{M}‌‍]/u

// Split markdown into blocks at blank lines (outside code fences, and never
// before a list/indented continuation) so finished blocks can be memoised and
// only the last one is re-parsed while streaming.
function splitBlocks(text: string): string[] {
  const blocks: string[] = []
  let cur: string[] = []
  let fenced = false
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) fenced = !fenced
    cur.push(line)
    const next = lines[i + 1]
    if (!fenced && line.trim() === '' && next !== undefined && next.trim() !== '' && !/^(\s|[-*+]\s|\d+[.)]\s|\||>)/.test(next)) {
      blocks.push(cur.join('\n'))
      cur = []
    }
  })
  if (cur.length) blocks.push(cur.join('\n'))
  return blocks
}

// Close markdown the stream hasn't finished yet so it never flashes raw `**`/backticks.
function closeOpenMarkdown(text: string): string {
  let out = text
  if ((out.match(/^\s*```/gm) ?? []).length % 2) return `${out}\n\`\`\``
  if ((out.match(/\*\*/g) ?? []).length % 2) out += '**'
  if ((out.replaceAll(/```/g, '').match(/`/g) ?? []).length % 2) out += '`'
  return out
}

const MarkdownBlock = memo(function MarkdownBlock({ text }: Readonly<{ text: string }>) {
  return <ReactMarkdown components={MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
})

const StreamedMarkdown = memo(function StreamedMarkdown({ content, isFinal }: Readonly<{ content: string; isFinal: boolean }>) {
  const [shown, setShown] = useState(() => (isFinal ? content.length : 0))
  const textRef = useRef(content)
  textRef.current = content

  useEffect(() => {
    if (shown >= content.length) return
    const id = requestAnimationFrame(() => {
      const text = textRef.current
      const backlog = text.length - shown
      let n = Math.min(text.length, shown + Math.max(1, Math.ceil(backlog * 0.08)))
      if (n < text.length && n > 0 && /[\ud800-\udbff]/.test(text[n - 1])) n++
      while (n < text.length && COMBINING.test(text[n])) n++
      setShown(n)
    })
    return () => cancelAnimationFrame(id)
  }, [shown, content])

  const live = !isFinal || shown < content.length
  const visible = content.slice(0, shown)
  const blocks = splitBlocks(visible)
  if (live && blocks.length) blocks.push(closeOpenMarkdown(blocks.pop() ?? ''))
  let offset = 0
  const keyed = blocks.map((text) => {
    const key = offset // a block's start position never changes while it streams, so it is a stable key
    offset += text.length
    return { key, text }
  })
  return (
    <>
      {keyed.map((b) => <MarkdownBlock key={b.key} text={b.text} />)}
      {live ? <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gray-400 align-middle dark:bg-gray-500" /> : null}
    </>
  )
})


export default function PiChatView({
  projectId,
  sessionId,
  initialMessages,
  readOnly,
  readOnlyLabel,
  onSessionCreated,
  onTurnComplete,
}: Readonly<{
  projectId: string
  sessionId?: string
  initialMessages?: Message[]
  readOnly?: boolean
  readOnlyLabel?: string
  onSessionCreated?: (sessionId: string) => void
  onTurnComplete?: () => void
}>) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? [])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  // `messages` only reads `initialMessages` once, at mount. If this component
  // survives a soft client-side navigation away and back (same `key`, no
  // remount) while the parent page's query refetches fresh data in the
  // background, that fresh prop would otherwise never reach this state —
  // exactly the "latest messages gone until hard refresh" symptom. Skipped
  // while actively streaming so an in-flight reply can't get clobbered by a
  // same-tab refetch racing it.
  useEffect(() => {
    if (!isStreaming) setMessages(initialMessages ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages])
  const [contextUsage, setContextUsage] = useState<{ used: number; limit: number } | null>(null)
  const [recording, setRecording] = useState(false)
  const [partialText, setPartialText] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef(sessionId)
  const stickToBottomRef = useRef(true)
  const programmaticUntilRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const MAX_TEXTAREA_PX = 160

  const pinToBottom = useCallback((stuck: boolean) => {
    stickToBottomRef.current = stuck
    setAtBottom((prev) => (prev === stuck ? prev : stuck))
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    programmaticUntilRef.current = performance.now() + 150
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    sessionIdRef.current = sessionId
    if (!sessionId || readOnly) return
    try { localStorage.setItem(`pi-last:${projectId}`, sessionId) } catch {}
  }, [sessionId, projectId, readOnly])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (performance.now() < programmaticUntilRef.current) return
      pinToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [pinToBottom])

  const openedAtBottom = useRef(false)
  useLayoutEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    if (!openedAtBottom.current) {
      openedAtBottom.current = true
      const last = scroller.querySelector('[data-pi-last="true"]') as HTMLElement | null
      if (last && last.offsetHeight > scroller.clientHeight) {
        const top = last.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
        programmaticUntilRef.current = performance.now() + 150
        scroller.scrollTop = Math.max(0, top - 8)
        pinToBottom(false)
        return
      }
    }
    if (stickToBottomRef.current) scrollToBottom()
  }, [messages, scrollToBottom, pinToBottom])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollToBottom()
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [scrollToBottom])

  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set())

  // The button's own click handler — never goes through the model. The server
  // looks up what was actually proposed from its own stored record of this
  // exact toolCallId and executes (or cancels) that, ignoring anything this
  // client might claim about it.
  const resolvePendingAction = useCallback(async (toolCallId: string, decision: 'confirm' | 'cancel') => {
    if (!sessionIdRef.current) return
    setResolvingIds((prev) => new Set(prev).add(toolCallId))
    try {
      const res = await fetch('/api/pi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sessionId: sessionIdRef.current, resolveAction: { toolCallId, decision } }),
      })
      const data = await res.json().catch(() => null)
      const result = res.ok ? data.result : { error: data?.error ?? 'Could not complete that action' }
      const success = res.ok ? data.success : false
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          toolCalls: m.toolCalls?.map((tc) => (tc.id === toolCallId ? { ...tc, result, success } : tc)),
        }))
      )
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev)
        next.delete(toolCallId)
        return next
      })
    }
  }, [projectId])

  const sendMessage = useCallback(async (userContent: string, historyBefore: Message[]) => {
    if (isStreaming || !userContent.trim() || readOnly) return
    pinToBottom(true)
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userContent, isFinal: true }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', isFinal: false, toolCalls: [] }
    setMessages([...historyBefore, userMsg, assistantMsg])
    setIsStreaming(true)

    try {
      const res = await fetch('/api/pi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userContent, projectId, sessionId: sessionIdRef.current }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: err.error ?? 'Error', isFinal: true } : m)))
        return
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isFinal: true } : m)))
            continue
          }
          try {
            const { text, error, toolCall, toolResult, sessionId: newSessionId, usage } = JSON.parse(payload)
            if (usage) {
              setContextUsage(usage)
            } else if (newSessionId && !sessionIdRef.current) {
              sessionIdRef.current = newSessionId
              onSessionCreated?.(newSessionId)
            } else if (error) {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: error, isFinal: true } : m)))
            } else if (text) {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m)))
            } else if (toolCall) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), { id: toolCall.id, name: toolCall.name, arguments: toolCall.arguments, pending: true }] }
                    : m
                )
              )
            } else if (toolResult) {
              const href = toolResult.result?.href
              if (toolResult.success && typeof href === 'string' && href.startsWith(`/${projectId}/`)) {
                router.push(href)
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: (m.toolCalls ?? []).map((tc) =>
                          tc.id === toolResult.id ? { ...tc, result: toolResult.result, success: toolResult.success, pending: false } : tc
                        ),
                      }
                    : m
                )
              )
            }
          } catch {
            // malformed chunk
          }
        }
      }
      onTurnComplete?.()
    } catch (err: any) {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: err?.message ?? 'Network error', isFinal: true } : m)))
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, projectId, readOnly, onSessionCreated, onTurnComplete, pinToBottom, router])

  const autoGrow = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`
  }, [])

  const handleSubmit = () => {
    const text = input
    if (!text.trim()) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(text, messages)
  }

  const stopRecording = () => {
    dataChannelRef.current?.close()
    peerConnectionRef.current?.close()
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    dataChannelRef.current = null
    peerConnectionRef.current = null
    micStreamRef.current = null
    setRecording(false)
    // don't lose the last few words if .completed hadn't arrived yet when you clicked stop
    setPartialText((prev) => {
      if (prev.trim()) setInput((input) => (input ? `${input} ${prev.trim()}` : prev.trim()))
      return ''
    })
  }

  // True continuous streaming, same transport class ChatGPT/Claude's own voice
  // input uses: the mic track streams straight to OpenAI over WebRTC — no
  // manual chunking, no client-side endpointing — OpenAI's own server-side VAD
  // (session.update below) decides utterance boundaries from the continuous
  // stream, which is what the three earlier chunked/browser-recognition
  // attempts could never do correctly. The ephemeral token (minted by
  // /api/pi/realtime-token) is the only thing our server touches; audio and
  // transcripts flow browser-to-OpenAI directly.
  const toggleRecording = async () => {
    if (recording) {
      stopRecording()
      return
    }
    setMicError(null)
    try {
      const tokenRes = await fetch('/api/pi/realtime-token', { method: 'POST' })
      const tokenData = await tokenRes.json().catch(() => null)
      if (!tokenRes.ok) throw new Error(tokenData?.error ?? 'Could not start voice input')
      const ephemeralToken = tokenData.token as string

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream

      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc
      pc.addTrack(stream.getTracks()[0])

      const dc = pc.createDataChannel('oai-events')
      dataChannelRef.current = dc
      dc.onopen = () => {
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            type: 'transcription',
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: 24000 },
                transcription: { model: 'gpt-4o-transcribe', language: 'en' },
                turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 500 },
              },
            },
          },
        }))
      }
      dc.onmessage = (e) => {
        let event: any
        try { event = JSON.parse(e.data) } catch { return }
        if (event.type === 'conversation.item.input_audio_transcription.delta') {
          // live, word-by-word as OpenAI transcribes — this is what actually
          // removes the lag; waiting for .completed alone means nothing shows
          // until the whole utterance plus the silence pause has passed
          if (event.delta) setPartialText((prev) => prev + event.delta)
          autoGrow()
        } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
          // authoritative final text for this utterance — replaces the (possibly
          // rougher) accumulated deltas rather than appending alongside them
          const text = (event.transcript ?? '').trim()
          setPartialText('')
          if (!text) return
          setInput((prev) => (prev ? `${prev} ${text}` : text))
          autoGrow()
        } else if (event.type === 'error') {
          setMicError(event.error?.message ?? 'Voice input failed.')
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${ephemeralToken}`, 'Content-Type': 'application/sdp' },
      })
      if (!sdpRes.ok) throw new Error('Could not connect voice input')
      await pc.setRemoteDescription({ type: 'answer', sdp: await sdpRes.text() })

      setRecording(true)
    } catch (err: any) {
      stopRecording()
      setMicError(err?.message ?? 'Microphone access was denied — allow it in your browser’s site settings.')
    }
  }

  const micSupported = !!globalThis.navigator?.mediaDevices?.getUserMedia && globalThis.RTCPeerConnection !== undefined

  const showContextHint = messages.length > 0 || !!sessionIdRef.current

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {readOnly && (
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          {readOnlyLabel ?? 'Read-only conversation'}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} className="h-full overflow-x-hidden overflow-y-auto">
        <div ref={contentRef} className="mx-auto min-w-0 max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          {messages.length === 0 && !readOnly && (
            <div className="pt-[8vh] sm:pt-[10vh]">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-[28px]">Hi, I'm π.</h1>
              <p className="mt-2 max-w-xl text-[15px] leading-7 text-gray-600 dark:text-gray-400">
                Ask me about your call analytics, create or update an agent, or attach an inbound phone number — right here in this chat.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s, messages)}
                    className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-left text-[13px] leading-snug text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-900/80"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-8">
            {(() => {
              let latestVoiceId: string | null = null
              let latestToolFormId: string | null = null
              let latestAgentSelectorId: string | null = null
              for (const msg of messages) {
                for (const tc of msg.toolCalls ?? []) {
                  if (voiceTarget(tc)) latestVoiceId = tc.id
                  if (toolForm(tc)) latestToolFormId = tc.id
                  if (agentSelector(tc)) latestAgentSelectorId = tc.id
                }
              }
              return messages.map((m, index) =>
              m.role === 'user' ? (
                <div key={m.id} data-pi-last={index === messages.length - 1 ? 'true' : undefined} className="flex min-w-0 justify-end">
                  <UserMessage content={m.content} />
                </div>
              ) : (
                <div key={m.id} data-pi-last={index === messages.length - 1 ? 'true' : undefined} className="min-w-0 max-w-full break-words">
                  {m.toolCalls?.some((t) => t.pending) && (
                    <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
                      {m.toolCalls.filter((t) => t.pending).map((tc) => (
                        <ToolCallLine key={tc.id} tc={tc} />
                      ))}
                    </div>
                  )}
                  {m.content && <StreamedMarkdown content={m.content} isFinal={m.isFinal} />}
                  {!m.content && !m.isFinal && <ThinkingIndicator />}
                  {m.toolCalls?.map((tc) => {
                    const target = tc.id === latestVoiceId ? voiceTarget(tc) : null
                    const form = tc.id === latestToolFormId ? toolForm(tc) : null
                    const page = pageTarget(tc)
                    const agents = tc.id === latestAgentSelectorId ? agentSelector(tc) : null
                    const pending = pendingAction(tc)
                    const resolving = resolvingIds.has(tc.id)
                    const cancelled = tc.result?.__cancelled === true
                    return (
                      <div key={tc.id}>
                        {target ? <PiVoiceCall agentName={target.agentName} label={target.label} /> : null}
                        {form ? <PiCustomToolForm projectId={projectId} agentId={form.agentId} label={form.label} draft={form.draft} toolCallId={tc.id} /> : null}
                        {page ? (
                          <Link href={page.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-gray-900 px-3 py-1.5 text-[13px] text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900">
                            {page.label}
                          </Link>
                        ) : null}
                        {agents ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {agents.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => sendMessage(a.display_name, messages)}
                                className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600"
                              >
                                {a.display_name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {pending ? (
                          <div className="mt-3 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                            <p className="text-[13px] text-amber-900 dark:text-amber-200">{pending.summary}</p>
                            <div className="mt-2.5 flex gap-2">
                              <button
                                type="button"
                                disabled={resolving}
                                onClick={() => resolvePendingAction(tc.id, 'confirm')}
                                className="rounded-lg bg-gray-900 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                disabled={resolving}
                                onClick={() => resolvePendingAction(tc.id, 'cancel')}
                                className="rounded-lg border border-amber-300 px-3 py-1.5 text-[13px] font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {cancelled && <p className="mt-2 text-[12px] text-gray-400">Cancelled.</p>}
                        {(tc.name === 'buy_plivo_number' || tc.name === 'attach_inbound_number') && tc.result && !tc.result.__pending && !cancelled && (
                          tc.success === false || tc.result.error ? (
                            <p className="mt-2 max-w-md rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/30 dark:text-red-300">Failed: {String(tc.result.error ?? 'Something went wrong')}</p>
                          ) : (
                            <p className="mt-2 max-w-md rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                              {tc.name === 'buy_plivo_number'
                                ? `Bought ${tc.result.bought} ($${Number(tc.result.monthly_rental_rate_usd).toFixed(2)}/month). Ask me to attach it to an agent.`
                                : `Attached ${tc.result.attached} to ${tc.result.agent} for inbound calls (${tc.result.alias}).`}
                            </p>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            )
            })()}
          </div>
        </div>
      </div>
        {!atBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => { pinToBottom(true); scrollToBottom() }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[12px] text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            Latest messages
          </button>
        )}
      </div>

      {!readOnly && (
        <div className="shrink-0 border-t border-gray-800 bg-gray-900 px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-gray-700 bg-gray-950 px-3 py-2.5 focus-within:border-gray-600">
              <textarea
                ref={textareaRef}
                value={composeInput(recording, partialText, input)}
                onChange={(e) => { setInput(e.target.value); autoGrow() }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                placeholder="Ask Pi…"
                rows={1}
                disabled={isStreaming || recording}
                className="w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-6 text-gray-100 placeholder:text-gray-500 focus:outline-none disabled:opacity-60"
                style={{ maxHeight: MAX_TEXTAREA_PX }}
              />
              <div className="mt-1 flex items-center justify-end gap-1.5">
                {micSupported && (
                  <button
                    type="button"
                    onClick={toggleRecording}
                    aria-label={recording ? 'Stop voice input' : 'Start voice input'}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:cursor-wait ${recording ? 'animate-pulse bg-red-500/20 text-red-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isStreaming || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
            {micError && (
              <p className="mt-2 text-center text-[11px] text-red-400">{micError}</p>
            )}
            {contextUsage && (() => {
              const pct = Math.min(100, Math.round((contextUsage.used / contextUsage.limit) * 100))
              return (
                <div className="mt-2 flex items-center justify-center gap-2" title={`${contextUsage.used.toLocaleString()} / ${contextUsage.limit.toLocaleString()} tokens used this turn`}>
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full rounded-full ${usageBarColor(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400">{pct}% of context used</span>
                </div>
              )
            })()}
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                title="Phone numbers are masked before reaching the model, both when a field is deliberately grouped by and as a general backstop over every tool result — never sent to the LLM in full."
              >
                PII redacted
              </span>
            </div>
            {showContextHint && (
              <p className="mt-2 text-center text-[11px] text-gray-400 dark:text-gray-500">
                This chat is saved for your organization. Pi remembers recent messages in this thread when replying.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
