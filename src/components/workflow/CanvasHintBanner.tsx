'use client'

import React, { useEffect, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { useWorkflowStore } from '@/stores/workflowStore'

const STORAGE_KEY = 'whispey-workflow-checklist-dismissed'

type Step = { id: string; title: string; hint: string; done: boolean; action: string; onClick: () => void }

type Props = Readonly<{
  onAskPi: () => void
  onShowIssues: () => void
  onOpenAgent: () => void
  onOpenKnowledge: () => void
  onTest: () => void
  deployed: boolean
  tested: boolean
  voiceChecked: boolean
  paletteOpen: boolean
}>

/** A short "how to get an agent live" list that ticks itself off, for people new to flows. */
export function CanvasHintBanner(p: Props) {
  const [dismissed, setDismissed] = useState(true) // hidden until localStorage is read, to avoid a flash
  const [collapsed, setCollapsed] = useState(false)
  const chatStreaming = useWorkflowStore((s) => s.chatStreaming)
  const workflow = useWorkflowStore((s) => s.workflow)
  const issues = useWorkflowStore((s) => s.lintIssues)

  useEffect(() => {
    try {
      setDismissed(globalThis.localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (dismissed || chatStreaming || !workflow) return null

  const errors = issues.filter((i) => i.severity === 'error').length
  const steps: Step[] = [
    { id: 'describe', title: 'Describe the call', hint: 'Tell Pi what the agent should do. It builds the steps for you.', done: workflow.nodes.filter((n) => n.type !== 'note').length >= 3, action: 'Ask Pi', onClick: p.onAskPi },
    { id: 'fix', title: 'Fix any problems', hint: 'Open the list and click a problem to jump to that step.', done: errors === 0 && workflow.nodes.length > 1, action: 'Show problems', onClick: p.onShowIssues },
    { id: 'voice', title: 'Choose the voice and language', hint: 'How the agent sounds and which language it hears.', done: p.voiceChecked, action: 'Open', onClick: p.onOpenAgent },
    { id: 'docs', title: 'Add documents (optional)', hint: 'Upload FAQs or plan details the agent can answer from.', done: !!workflow.agent.knowledge?.enabled, action: 'Upload', onClick: p.onOpenKnowledge },
    { id: 'deploy', title: 'Deploy', hint: 'Makes your changes live.', done: p.deployed, action: '', onClick: () => {} },
    { id: 'test', title: 'Make a test call', hint: 'Talk to the agent in your browser.', done: p.tested, action: 'Test call', onClick: p.onTest },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)

  const dismiss = () => {
    setDismissed(true)
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
  }

  return (
    <div className={`absolute top-3 z-10 ${p.paletteOpen ? 'left-[15.5rem]' : 'left-3'} w-72 rounded-xl border border-border bg-card text-xs shadow-md`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" onClick={() => setCollapsed((v) => !v)} className="flex flex-1 items-center gap-2 text-left" aria-expanded={!collapsed}>
          <span className="font-semibold text-foreground">Get your agent live</span>
          <span className="text-muted-foreground">{doneCount} of {steps.length}</span>
          <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
        <button type="button" onClick={dismiss} aria-label="Hide checklist" className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {!collapsed && (
        <ol className="space-y-1 border-t border-border p-2">
          {steps.map((s) => (
            <li key={s.id} className={`flex items-start gap-2 rounded-lg p-2 ${s === next ? 'bg-accent' : ''}`}>
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border'}`}>
                {s.done && <Check className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={s.done ? 'text-muted-foreground line-through' : 'font-medium text-foreground'}>{s.title}</p>
                {s === next && <p className="mt-0.5 text-muted-foreground">{s.hint}</p>}
              </div>
              {s === next && s.action && (
                <button type="button" onClick={s.onClick} className="shrink-0 rounded-md border border-border bg-background px-2 py-1 font-medium text-foreground hover:bg-accent">
                  {s.action}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
