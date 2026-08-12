'use client'

import React, { useMemo, useState } from 'react'
import { Code2, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Workflow } from '@/lib/workflow/schema'
import {
  getKnownVariables,
  LOGIC_OPERATORS,
  parseSimpleExpression,
  buildSimpleExpression,
  type ParsedCondition,
} from '@/lib/workflow/logicExpression'

/** Builder for a "logic" edge's expression — pick variable/operator/value instead of
 * typing raw Python-ish syntax. Falls back to a raw-text "Custom" mode for anything
 * the builder can't represent (&&, ||, nested expressions, ...). Pass key={edge.id}
 * from the caller so this remounts (and re-detects the right mode) per edge. */
export function LogicConditionField({ workflow, value, onChange }: Readonly<{ workflow: Workflow; value: string; onChange: (expr: string) => void }>) {
  const knownVars = useMemo(() => getKnownVariables(workflow), [workflow])
  const parsed = useMemo(() => parseSimpleExpression(value), [value])
  const [mode, setMode] = useState<'builder' | 'custom'>(parsed || !value ? 'builder' : 'custom')

  const current: ParsedCondition = parsed ?? { variable: knownVars[0]?.name ?? '', operator: '==', value: '' }
  const varType = knownVars.find((v) => v.name === current.variable)?.type ?? 'string'

  const update = (patch: Partial<ParsedCondition>) => {
    const next = { ...current, ...patch }
    const nextType = knownVars.find((v) => v.name === next.variable)?.type ?? 'string'
    onChange(buildSimpleExpression(next, nextType))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Expression</Label>
        <Button type="button" variant="ghost" size="sm" className="h-5 text-[11px] px-1.5" onClick={() => setMode(mode === 'builder' ? 'custom' : 'builder')}>
          {mode === 'builder' ? (
            <>
              <Code2 className="h-3 w-3 mr-1" /> Custom
            </>
          ) : (
            <>
              <SlidersHorizontal className="h-3 w-3 mr-1" /> Builder
            </>
          )}
        </Button>
      </div>

      {mode === 'builder' ? (
        <>
          <div className="flex gap-1.5 items-center">
            {knownVars.length > 0 ? (
              <Select value={current.variable} onValueChange={(v) => update({ variable: v })}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="variable" />
                </SelectTrigger>
                <SelectContent>
                  {knownVars.map((v) => (
                    <SelectItem key={v.name} value={v.name}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input placeholder="variable" value={current.variable} onChange={(e) => update({ variable: e.target.value })} className="h-8 text-xs flex-1" />
            )}
            <Select value={current.operator} onValueChange={(v) => update({ operator: v })}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGIC_OPERATORS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {varType === 'boolean' ? (
              <Select value={current.value || 'true'} onValueChange={(v) => update({ value: v })}>
                <SelectTrigger className="h-8 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">true</SelectItem>
                  <SelectItem value="false">false</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={varType === 'number' ? 'number' : 'text'}
                placeholder="value"
                value={current.value}
                onChange={(e) => update({ value: e.target.value })}
                className="h-8 text-xs w-24"
              />
            )}
          </div>
          {knownVars.length === 0 && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              No known variables yet — declare one in Variables, or add an extraction / save-to-variable field upstream.
            </p>
          )}
        </>
      ) : (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. party_size > 6 && vip == true" className="font-mono text-xs" />
      )}
    </div>
  )
}
