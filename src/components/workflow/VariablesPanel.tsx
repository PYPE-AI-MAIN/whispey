'use client'

import React from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { VarType } from '@/lib/workflow/schema'

export function VariablesPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const variables = useWorkflowStore((s) => s.workflow?.variables ?? [])
  const patchWorkflow = useWorkflowStore((s) => s.patchWorkflow)

  const setVariables = (next: typeof variables) => patchWorkflow({ variables: next })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Variables</SheetTitle>
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
          {variables.map((v, i) => (
            <div key={i} className="flex gap-1.5 items-start border-b border-gray-100 dark:border-gray-800 pb-2">
              <Input
                placeholder="key"
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
              <Input
                placeholder="default"
                value={v.default ?? ''}
                onChange={(e) => {
                  const next = [...variables]
                  next[i] = { ...v, default: e.target.value }
                  setVariables(next)
                }}
                className="h-8 text-xs w-24"
              />
              <Input
                placeholder="description"
                value={v.description ?? ''}
                onChange={(e) => {
                  const next = [...variables]
                  next[i] = { ...v, description: e.target.value }
                  setVariables(next)
                }}
                className="h-8 text-xs flex-1"
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setVariables(variables.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {!variables.length && (
            <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
              No variables yet. Nodes reference these by <code>{'{{key}}'}</code>.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
