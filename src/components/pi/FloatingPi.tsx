'use client'

// Ask Pi, floating bottom-right on every project page (drag it up or down). One
// conversation that follows you between pages and, with each message, sends where
// you are: the route, the agent in the URL, the page's title and visible text, plus
// whatever the page registers through usePiSurface. A page with its own kind of
// chat (Call Logs filters, workflow edits, dashboard charts) renders it in here
// through <PiDockBody> instead. Not shown to viewers or on the full-page Pi.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { Maximize2, Minimize2, RotateCcw, X } from 'lucide-react'
import PiChatView from '@/components/pi/PiChatView'
import { PiMark } from '@/components/calls/v2/AskPi'
import { usePiDock } from '@/contexts/PiDockContext'
import { getUserProjectRole } from '@/services/getUserRole'
import { isViewerRole } from '@/utils/callLogsUtils'
import { V2_THEME } from '@/components/calls/v2/theme'
import { cn } from '@/lib/utils'

const FAB_OFFSET_KEY = 'whispey:askPiFabOffset'
const maxFabLift = () => Math.max(0, Math.min(320, globalThis.innerHeight - 260))
const MAX_VISIBLE_CHARS = 12_000

function readOffset(): number {
  try {
    const v = Number(globalThis.localStorage?.getItem(FAB_OFFSET_KEY))
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
}

// [section after /agents/{id}/, header chip, starter questions]
const AGENT_SECTIONS: Record<string, [string, string[]]> = {
  '': ['Agent dashboard', ['How is this agent performing this week?', 'Which outcomes are most common?', 'What should I add to this dashboard?']],
  config: ['Agent config', ["Review this agent's prompt for gaps", "What would make this agent's greeting better?", 'Which variables and tools does it use?']],
  knowledge: ['Knowledge base', ['What is in this agent’s knowledge base?', 'What could it not answer from it?']],
  observability: ['Call logs', ['Summarise what happened in today’s calls', 'Why did today’s failed calls fail?', 'Show me flagged calls']],
  'phone-call-config': ['Phone settings', ['Which numbers are attached to this agent?', 'Is this set up for inbound calls?']],
  playground: ['Playground', ['What should I test on this agent?']],
  'prompt-forge': ['Prompt Forge', ['Why did the agent answer like that?', 'What’s missing or contradictory in this prompt?']],
  qa: ['QA', ['What are the most common issues flagged?', 'Which calls should I review first?']],
  workflow: ['Workflow', ['Describe what this workflow does', 'What is missing from this flow?']],
}
const PROJECT_SECTIONS: Record<string, string> = { analytics: 'Overview', agents: 'Agents', campaigns: 'Campaigns', settings: 'Settings' }
const PROJECT_SUGGESTIONS = ['How is call volume trending over the last 30 days?', 'Which agent handled the most calls, and how did they perform?', 'Create a new voice agent']

function describePage(pathname: string, agentId: string | undefined): { label: string; suggestions: { label: string; prompt: string }[] } {
  const parts = pathname.split('/').filter(Boolean)
  const toChips = (qs: string[]) => qs.map((q) => ({ label: q, prompt: q }))
  if (agentId && parts[1] === 'agents') {
    const [label, qs] = AGENT_SECTIONS[parts[3] ?? ''] ?? [parts[3] ?? 'Agent', []]
    return { label, suggestions: toChips(qs) }
  }
  return { label: PROJECT_SECTIONS[parts[1] ?? ''] ?? 'This page', suggestions: toChips(PROJECT_SUGGESTIONS) }
}

/** The page as the user sees it: title and visible text of the main area. */
function readPage(): { title: string; visibleText: string } {
  const main = document.querySelector('main') ?? document.body
  const text = (main as HTMLElement).innerText?.replaceAll(/\n{3,}/g, '\n\n').trim() ?? ''
  return { title: document.title, visibleText: text.slice(0, MAX_VISIBLE_CHARS) }
}

export default function FloatingPi() {
  const dock = usePiDock()
  const pathname = usePathname()
  const params = useParams()
  const projectId = params.projectid as string | undefined
  const agentId = params.agentid as string | undefined
  const { user } = useUser()
  const [mounted, setMounted] = useState(false)
  const [chatKey, setChatKey] = useState(0)
  // With a page chat that has a tab, which of the two is showing
  const [askAnything, setAskAnything] = useState(false)
  // How far the button has been dragged up from its resting place (negative = up).
  const [lift, setLift] = useState(0)
  const drag = useRef<{ y: number; start: number; moved: boolean } | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const liftRef = useRef(0)
  liftRef.current = lift

  useEffect(() => {
    setMounted(true)
    setLift(Math.max(-maxFabLift(), Math.min(0, readOffset())))
  }, [])

  const { data: role } = useQuery({
    queryKey: ['pi-dock-role', projectId, user?.id],
    queryFn: async () => (await getUserProjectRole(user?.primaryEmailAddress?.emailAddress ?? '', projectId as string, user?.id)).role as string | null,
    enabled: !!projectId && !!user,
    staleTime: 5 * 60 * 1000,
  })

  const open = dock?.open ?? false
  const setOpen = dock?.setOpen
  const max = dock?.max ?? false
  const gettersRef = dock?.gettersRef

  const getPageContext = useCallback(() => {
    const custom = gettersRef?.current.getContext?.()
    if (custom) return custom
    return {
      surface: 'page',
      route: globalThis.location.pathname + globalThis.location.search,
      agentId: agentId ?? null,
      ...readPage(),
      details: gettersRef?.current.getDetails?.() ?? null,
    }
  }, [agentId, gettersRef])

  const endDrag = useCallback(() => {
    const d = drag.current
    if (!d) return
    drag.current = null
    if (fabRef.current) delete fabRef.current.dataset.dragging
    if (d.moved) {
      try { globalThis.localStorage?.setItem(FAB_OFFSET_KEY, String(liftRef.current)) } catch { /* per-viewer nicety only */ }
    }
  }, [])

  useEffect(() => {
    globalThis.addEventListener('pointerup', endDrag)
    globalThis.addEventListener('blur', endDrag)
    return () => {
      globalThis.removeEventListener('pointerup', endDrag)
      globalThis.removeEventListener('blur', endDrag)
    }
  }, [endDrag])

  useEffect(() => {
    if (!open || !setOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    // capture: Esc here closes Pi instead of also closing whatever the page has open
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, setOpen])

  if (!mounted || !dock || !projectId || /^\/[^/]+\/pi(\/|$)/.test(pathname) || isViewerRole(role ?? 'viewer')) return null

  const page = describePage(pathname, agentId)
  const label = dock.surface?.label ?? page.label
  const suggestions = dock.surface?.suggestions?.length ? dock.surface.suggestions : page.suggestions
  const custom = dock.customCount > 0
  const tabbed = custom && !!dock.customLabel
  const showCustom = custom && !(tabbed && askAnything)

  return createPortal(
    <div className={V2_THEME}>
      <button
        ref={fabRef}
        type="button"
        title="Ask Pi · drag up or down to move"
        style={{ transform: `translateY(${lift}px)` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          drag.current = { y: e.clientY, start: lift, moved: false }
          try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          if (e.buttons === 0) return endDrag()
          const dy = e.clientY - d.y
          if (!d.moved && Math.abs(dy) > 4) {
            d.moved = true
            e.currentTarget.dataset.dragging = ''
          }
          if (d.moved) setLift(Math.max(-maxFabLift(), Math.min(0, d.start + dy)))
        }}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onClick={() => {
          // a drag ends with a click; it shouldn't also toggle the box
          if (fabRef.current?.dataset.justDragged) return
          setOpen?.(!open)
        }}
        onPointerUp={(e) => {
          if (drag.current?.moved) {
            e.currentTarget.dataset.justDragged = '1'
            setTimeout(() => { if (fabRef.current) delete fabRef.current.dataset.justDragged }, 0)
          }
        }}
        className={cn(
          'fixed bottom-24 right-5 z-[85] inline-flex h-10 cursor-pointer touch-none select-none items-center gap-2 rounded-full bg-[#d23d47] pl-1.5 pr-4 text-[14px] font-semibold text-white',
          'shadow-[0_8px_24px_rgba(229,83,91,.35),0_2px_6px_rgba(0,0,0,.25)] transition-shadow hover:shadow-[0_10px_28px_rgba(210,61,71,.5),0_2px_6px_rgba(0,0,0,.25)] data-[dragging]:cursor-grabbing',
          open && 'shadow-[0_0_0_3px_var(--cl-violet-soft),0_8px_24px_rgba(229,83,91,.35)]'
        )}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20"><PiMark className="h-3.5 w-3.5" /></span>
        <span>Ask Pi</span>
      </button>

      {/* Kept mounted while closed, so the conversation survives closing the box and moving between pages. */}
      {/* A region, not a dialog: the page stays usable (and its shortcuts live) while it's open. */}
      <section
        aria-label="Ask Pi"
        hidden={!open}
        // never taller than the room above it, wherever the button has been dragged to
        style={{ bottom: `${148 - lift}px`, maxHeight: `calc(100vh - ${148 - lift + 16}px)` }}
        className={cn(
          'fixed right-5 z-[90] flex flex-col overflow-hidden rounded-2xl border border-[var(--cl-border2)] bg-[var(--cl-panel)] text-[var(--cl-text)] shadow-[var(--cl-shadow)] transition-[width,height] duration-200',
          max ? 'h-[min(760px,calc(100vh-120px))] w-[min(720px,calc(100vw-32px))]' : 'h-[min(560px,calc(100vh-180px))] w-[400px]'
        )}
      >
        <div className="flex flex-none items-center gap-2 border-b border-[var(--cl-border)] py-[9px] pl-3 pr-2.5">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[var(--cl-violet)] text-white"><PiMark className="h-3 w-3" /></span>
          <b className="text-[14px]">Ask Pi</b>
          <span className="min-w-0 truncate rounded-full border border-[var(--cl-border2)] px-[9px] py-0.5 text-[12.5px] text-[var(--cl-text2)]" title={label}>{label}</span>
          <span className="flex-1" />
          {!showCustom && <HeaderButton label="New chat" onClick={() => setChatKey((k) => k + 1)}><RotateCcw className="h-3.5 w-3.5" /></HeaderButton>}
          <HeaderButton label={max ? 'Shrink' : 'Expand'} onClick={() => dock.setMax(!max)}>{max ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</HeaderButton>
          <HeaderButton label="Close (Esc)" onClick={() => setOpen?.(false)}><X className="h-4 w-4" /></HeaderButton>
        </div>

        {tabbed && (
          <div role="tablist" className="flex flex-none gap-1 border-b border-[var(--cl-border)] px-3 py-1.5">
            <TabButton active={!askAnything} onClick={() => setAskAnything(false)}>{dock.customLabel}</TabButton>
            <TabButton active={askAnything} onClick={() => setAskAnything(true)}>Ask anything</TabButton>
          </div>
        )}

        {/* A page's own chat, when it has one (see PiDockBody) */}
        <div ref={dock.setSlot} hidden={!showCustom} className="flex min-h-0 flex-1 flex-col" />
        <div hidden={showCustom} className="min-h-0 flex-1">
          <PiChatView key={chatKey} compact projectId={projectId} pageContext={getPageContext} suggestions={suggestions} />
        </div>
      </section>
    </div>,
    document.body,
  )
}

function TabButton({ active, onClick, children }: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('rounded-full px-3 py-1 text-[13px] font-medium', active ? 'bg-[var(--cl-violet-soft)] text-[var(--cl-violet-text)]' : 'text-[var(--cl-text3)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]')}
    >
      {children}
    </button>
  )
}

function HeaderButton({ label, onClick, children }: Readonly<{ label: string; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-[26px] w-[26px] place-items-center rounded-md text-[var(--cl-text3)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]">
      {children}
    </button>
  )
}
