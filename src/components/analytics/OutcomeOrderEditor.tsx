/**
 * Which outcome beats which, set once per agent — Confluence "Analytics Phase 1
 * and 2 — Build Spec" §10.6.
 *
 * This is the piece that beats Metabase rather than matching it. That order is
 * currently copied into eight separate queries, so changing it means editing all
 * eight and hoping none were missed. Here it is one list: reorder it and every
 * chart, drill-down and export moves together.
 *
 * Which is also why the warning is not decoration. Reordering does not change
 * what happens next — it changes what last quarter's numbers were.
 */
'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, GripVertical, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CatalogField } from '@/types/analytics'

export type OutcomeRanking = { field: { col: string; path?: string[] }; order: string[] } | null

const keyOf = (f: { col: string; path?: string[] }) => `${f.col}::${(f.path ?? []).join('.')}`

export function OutcomeOrderEditor({
  agentId, fields, current, open, onClose, onSaved,
}: {
  agentId: string
  fields: CatalogField[]
  current: OutcomeRanking
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  // an outcome is a short list of named results, which is exactly what the
  // catalog calls an enum
  const candidates = useMemo(() => fields.filter((f) => f.value_type === 'enum' && (f.enum_values?.length ?? 0) > 1), [fields])

  const [fieldKey, setFieldKey] = useState('')
  const [order, setOrder] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    const chosen = current?.field ? candidates.find((f) => keyOf(f) === keyOf(current.field)) : candidates[0]
    setFieldKey(chosen ? keyOf(chosen) : '')
    // keep the saved order, then append anything the agent has started producing
    // since — a new outcome ranks last rather than silently ranking first
    const known = current?.order ?? []
    const all = chosen?.enum_values ?? []
    setOrder([...known.filter((v) => all.includes(v)), ...all.filter((v) => !known.includes(v))])
  }, [open, current, candidates])

  const field = candidates.find((f) => keyOf(f) === fieldKey)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = order.indexOf(String(e.active.id))
    const to = order.indexOf(String(e.over.id))
    if (from < 0 || to < 0) return
    setOrder(arrayMove(order, from, to))
  }

  const persist = async () => {
    if (!field) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/outcome-ranking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          field: { col: field.col, ...(field.path.length ? { path: field.path } : {}) },
          order,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? 'Could not save the order')
      onSaved()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">When we called more than once, which result wins?</DialogTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Drag to reorder. The top one is the best outcome. Anything not on this list ranks after everything on it.
          </p>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            This agent has no field with a short list of results yet, so there is nothing to rank.
          </p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Which field holds the result</label>
              <Select
                value={fieldKey}
                onValueChange={(v) => {
                  setFieldKey(v)
                  setOrder(candidates.find((f) => keyOf(f) === v)?.enum_values ?? [])
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Pick a field" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((f) => (
                    <SelectItem key={keyOf(f)} value={keyOf(f)}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-72 overflow-y-auto pt-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={order} strategy={verticalListSortingStrategy}>
                  {order.map((value, i) => (
                    <OutcomeRow key={value} value={value} rank={i + 1} isBest={i === 0} isWorst={i === order.length - 1} />
                  ))}
                </SortableContext>
              </DndContext>
              {order.length === 0 && <p className="py-4 text-center text-sm text-gray-500">No results recorded for this field yet.</p>}
            </div>

            {/* not decoration: this rewrites what last quarter's numbers were */}
            <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Changing this order changes past numbers too — every chart counting one row per patient is recalculated.</span>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={persist} disabled={saving || order.length === 0}>
                {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Save order
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OutcomeRow({ value, rank, isBest, isWorst }: { value: string; rank: number; isBest: boolean; isWorst: boolean }) {
  const s = useSortable({ id: value })
  return (
    <div
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}
      className={cn(
        'mb-1 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-800 dark:bg-gray-900',
        s.isDragging && 'opacity-70 shadow-md'
      )}
    >
      <button {...s.attributes} {...s.listeners} aria-label={`Move ${value}`} className="cursor-grab text-gray-300 dark:text-gray-600">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400">{rank}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
      {isBest && <span className="shrink-0 text-[11px] text-green-600 dark:text-green-500">best</span>}
      {isWorst && !isBest && <span className="shrink-0 text-[11px] text-gray-400">worst</span>}
    </div>
  )
}
