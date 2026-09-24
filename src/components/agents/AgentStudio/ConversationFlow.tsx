'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface FlowTurn {
  speaker: 'agent' | 'caller'
  text: string
}

export interface FlowStage {
  id: string
  label: string
  turns: FlowTurn[]
}

// Placeholder until the MCP writes a real flow for the agent.
export const SAMPLE_FLOW: FlowStage[] = [
  {
    id: 'greeting',
    label: 'Greeting',
    turns: [
      { speaker: 'agent', text: 'Hi, this is Ava from Acme Roofing — got a minute?' },
      { speaker: 'caller', text: 'Sure, what is this about?' },
    ],
  },
  {
    id: 'context',
    label: 'Context',
    turns: [
      { speaker: 'agent', text: 'You requested a quote on our site last week for a roof repair — just following up on that.' },
      { speaker: 'caller', text: 'Oh right, yes.' },
    ],
  },
  {
    id: 'qualify',
    label: 'Qualify',
    turns: [
      { speaker: 'agent', text: 'Are you the homeowner, and is this for a repair or a full replacement?' },
      { speaker: 'caller', text: "I'm the homeowner, just a repair — there's a leak near the chimney." },
      { speaker: 'agent', text: 'Got it. How long has it been leaking, and is there any visible damage inside?' },
      { speaker: 'caller', text: 'About two weeks. Small water stain on the ceiling.' },
      { speaker: 'agent', text: "Understood — I'll flag that for the inspector. What's your timeline to get it fixed?" },
      { speaker: 'caller', text: 'As soon as possible, ideally this week.' },
    ],
  },
  {
    id: 'book',
    label: 'Book',
    turns: [
      { speaker: 'agent', text: 'I have Tuesday 10am or Wednesday 2pm for a free inspection. Which works better?' },
      { speaker: 'caller', text: 'Wednesday 2pm works.' },
      { speaker: 'agent', text: "Booked — Wednesday 2pm. You'll get a text confirmation shortly." },
    ],
  },
  {
    id: 'close',
    label: 'Close',
    turns: [
      { speaker: 'agent', text: 'Anything else I can help with before I let you go?' },
      { speaker: 'caller', text: 'No, that covers it, thanks.' },
      { speaker: 'agent', text: 'Perfect — thanks for your time, see you Wednesday!' },
    ],
  },
]

export default function ConversationFlow({
  stages,
  isSample,
}: Readonly<{ stages: FlowStage[]; isSample: boolean }>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stageRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeId, setActiveId] = useState(stages[0]?.id)
  const turnCount = stages.reduce((n, s) => n + s.turns.length, 0)

  // Scroll-spy: the active stage is the last one whose top has scrolled past
  // the container's top edge.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const top = el.getBoundingClientRect().top + 24
      let current = stages[0]?.id
      for (const s of stages) {
        const node = stageRefs.current[s.id]
        if (node && node.getBoundingClientRect().top <= top) current = s.id
      }
      setActiveId(current)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [stages])

  const jumpTo = (id: string) => {
    const container = scrollRef.current
    const node = stageRefs.current[id]
    if (!container || !node) return
    container.scrollTo({ top: node.offsetTop - 8, behavior: 'smooth' })
    setActiveId(id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-3 dark:border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Conversation flow
              </h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About the conversation flow"
                      className="text-gray-300 transition hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[240px] text-xs">
                    The path designed for this agent when it was created through the MCP. Update it through the MCP — changes show up here.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400/80 dark:text-gray-500">
              {stages.length} stages · {turnCount} turns
            </p>
          </div>
          {isSample && (
            <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-px text-[10px] uppercase tracking-wide text-gray-400 dark:bg-gray-800/80 dark:text-gray-500">
              Sample
            </span>
          )}
        </div>

        {/* Stage stepper */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto">
          {stages.map((s, i) => (
            <div key={s.id} className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => jumpTo(s.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition',
                  activeId === s.id
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                )}
              >
                <span className="tabular-nums text-[10px] opacity-60">{i + 1}</span>
                {s.label}
              </button>
              {i < stages.length - 1 && <span className="text-gray-300 dark:text-gray-700">›</span>}
            </div>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ol className="space-y-6">
          {stages.map((s, i) => (
            <li
              key={s.id}
              ref={(node) => { stageRefs.current[s.id] = node }}
              className="relative pl-8"
            >
              {/* rail */}
              {i < stages.length - 1 && (
                <span
                  style={{ top: 28, bottom: -24, left: 11 }}
                  className="absolute w-px bg-gray-200 dark:bg-gray-800"
                />
              )}
              <span
                className={cn(
                  'absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums transition-colors',
                  activeId === s.id
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'
                )}
              >
                {i + 1}
              </span>

              <div className="flex items-baseline justify-between gap-2 pt-0.5">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.label}</h4>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {s.turns.length} {s.turns.length === 1 ? 'turn' : 'turns'}
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                {s.turns.map((t, j) => (
                  <div
                    key={j}
                    style={{ gridTemplateColumns: '52px 1fr' }}
                    className={cn(
                      'grid gap-2 rounded-lg px-2.5 py-2',
                      t.speaker === 'agent' && 'bg-gray-50 dark:bg-gray-800/50'
                    )}
                  >
                    <span
                      className={cn(
                        'pt-0.5 text-[10px] font-medium uppercase tracking-wide',
                        t.speaker === 'agent' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                      )}
                    >
                      {t.speaker === 'agent' ? 'Agent' : 'Caller'}
                    </span>
                    <p
                      className={cn(
                        'text-[13px] leading-relaxed',
                        t.speaker === 'agent'
                          ? 'text-gray-800 dark:text-gray-100'
                          : 'text-gray-500 dark:text-gray-400'
                      )}
                    >
                      {t.text}
                    </p>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
