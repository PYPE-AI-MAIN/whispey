'use client'

import React, { useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { VarType } from '@/lib/workflow/schema'

export function VariablesPanel({ open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (v: boolean) => void }>) {
  const variables = useWorkflowStore((s) => s.workflow?.variables ?? [])
  const patchWorkflow = useWorkflowStore((s) => s.patchWorkflow)

  const setVariables = (next: typeof variables) => patchWorkflow({ variables: next })

  // Stable per-row React key, independent of the editable `key` field — keying
  // rows by v.key (the field being typed into) remounted the input on every
  // keystroke and kicked focus out. Every add path appends at the end (manual
  // "+ Add variable" and auto-declared {{var}} refs alike), so growing this
  // by appending and shrinking it in lockstep with explicit deletes below
  // keeps a row's identity attached to its data across edits and deletes —
  // unlike a raw array index, which reassigns on every reorder.
  const rowIds = useRef<string[]>([])
  while (rowIds.current.length < variables.length) rowIds.current.push(crypto.randomUUID())
  if (rowIds.current.length > variables.length) rowIds.current = rowIds.current.slice(0, variables.length)

  const removeVariable = (i: number) => {
    rowIds.current = rowIds.current.filter((_, j) => j !== i)
    setVariables(variables.filter((_, j) => j !== i))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Variables</SheetTitle>
          <SheetDescription>
            Details the agent knows or collects, like a customer name or phone number. Write {'{{name}}'} in any step to use one.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 space-y-2">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVariables([...variables, { key: '', type: 'string' as VarType }])}
            >
              + Add variable
            </Button>
          </div>
          {variables.length > 0 && (
            <div className="flex gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="w-28">Name</span>
              <span className="w-24">Type</span>
              <span className="w-24">Starts as</span>
              <span className="flex-1">What it is</span>
              <span className="w-8" />
            </div>
          )}
          {variables.map((v, i) => {
            let boolDefault = ''
            if (v.default === true) boolDefault = 'true'
            else if (v.default === false) boolDefault = 'false'
            return (
            <div key={rowIds.current[i]} className="flex gap-1.5 items-start border-b border-border/60 pb-2">
              <Input
                placeholder="e.g. customer_name"
                value={v.key}
                onChange={(e) => {
                  const next = [...variables]
                  next[i] = { ...v, key: e.target.value }
                  setVariables(next)
                }}
                className="h-8 text-xs w-28"
              />
              <Select
                value={v.type}
                onValueChange={(val) => {
                  const next = [...variables]
                  next[i] = { ...v, type: val as VarType }
                  setVariables(next)
                }}
              >
                <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['string', 'number', 'boolean', 'object'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {v.type === 'boolean' ? (
                <Select
                  value={boolDefault}
                  onValueChange={(val) => {
                    const next = [...variables]
                    next[i] = { ...v, default: val === 'true' }
                    setVariables(next)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-24"><SelectValue placeholder="optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="optional"
                  type={v.type === 'number' ? 'number' : 'text'}
                  value={v.default ?? ''}
                  onChange={(e) => {
                    const next = [...variables]
                    // Keep the declared type: a number-typed variable with a
                    // string default silently breaks numeric logic-edge
                    // comparisons like "budget >= 5000" on the backend.
                    const raw = e.target.value
                    let nextDefault: string | number | undefined = raw
                    if (v.type === 'number') nextDefault = raw === '' ? undefined : Number(raw)
                    next[i] = { ...v, default: nextDefault }
                    setVariables(next)
                  }}
                  className="h-8 text-xs w-24"
                />
              )}
              <Input
                placeholder="e.g. the caller's full name"
                value={v.description ?? ''}
                onChange={(e) => {
                  const next = [...variables]
                  next[i] = { ...v, description: e.target.value }
                  setVariables(next)
                }}
                className="h-8 text-xs flex-1"
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeVariable(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            )
          })}
          {!variables.length && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No variables yet. Add one for anything you want to reuse, like a name or a date.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
