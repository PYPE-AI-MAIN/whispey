'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useWorkflowStore } from '@/stores/workflowStore'
import { QUICK_RULES } from './GlobalRulesPanel'

/**
 * "Let the call jump here from any step": the global rule for this step, as a switch on the step itself.
 * It saves the same global rule the Global rules panel lists, so nothing else changes.
 */
export function ReachableFromAnyStep({ nodeId }: Readonly<{ nodeId: string }>) {
  const workflow = useWorkflowStore((s) => s.workflow)
  const patchWorkflow = useWorkflowStore((s) => s.patchWorkflow)
  if (!workflow) return null

  const all = workflow.globalRules ?? []
  const mine = all.filter((r) => r.target === nodeId)
  const on = mine.length > 0

  const turnOn = () => patchWorkflow({ globalRules: [...all, { id: `global-${crypto.randomUUID().slice(0, 8)}`, target: nodeId, condition: '', sources: [] }] })
  const turnOff = () => patchWorkflow({ globalRules: all.filter((r) => r.target !== nodeId) })
  const setCondition = (ruleId: string, condition: string) => patchWorkflow({ globalRules: all.map((r) => (r.id === ruleId ? { ...r, condition } : r)) })

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Reachable from any step</p>
          <p className="text-[11px] text-muted-foreground">The call can jump here from any step when this happens, without a line from every step.</p>
        </div>
        <Switch checked={on} onCheckedChange={(v) => (v ? turnOn() : turnOff())} aria-label="Reachable from any step" />
      </div>
      {mine.map((rule) => (
        <div key={rule.id} className="space-y-1.5">
          <Textarea
            value={rule.condition}
            onChange={(e) => setCondition(rule.id, e.target.value)}
            placeholder="When… e.g. they ask for a human"
            className="min-h-[56px] text-xs"
          />
          {!rule.condition.trim() && (
            <div className="flex flex-wrap gap-1">
              {QUICK_RULES.map((q) => (
                <button key={q} type="button" onClick={() => setCondition(rule.id, q)} className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
