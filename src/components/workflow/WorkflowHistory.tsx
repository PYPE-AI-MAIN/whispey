'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { safeParseWorkflow } from '@/lib/workflow/schema'
import { stripExpandedEdges } from '@/lib/workflow/globalRules'
import { useWorkflowStore } from '@/stores/workflowStore'

type Version = { id: string; version_number: number; commit_message: string | null; created_by_email: string | null; created_at: string }

function when(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** Every deploy, newest first. Restoring puts that version in the editor; Deploy then publishes it as a new version. */
export function WorkflowHistory({ open, onOpenChange, agentId }: Readonly<{ open: boolean; onOpenChange: (v: boolean) => void; agentId: string }>) {
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow)
  const isDirty = useWorkflowStore((s) => s.isDirty)
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/history?page=1&limit=50`)
      const data = await res.json().catch(() => ({}))
      setVersions(res.ok && Array.isArray(data.history) ? data.history : [])
    } catch {
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const restore = async (v: Version) => {
    if (isDirty && !globalThis.confirm('You have unsaved changes. Replace them with this version?')) return
    setBusyId(v.id)
    try {
      const res = await fetch(`/api/agents/${agentId}/history/${v.id}`)
      const data = await res.json().catch(() => ({}))
      const parsed = safeParseWorkflow(data?.entry?.config_snapshot?.workflow)
      if (!res.ok || !parsed.success) {
        toast.error('That version has no workflow to restore')
        return
      }
      setWorkflow(stripExpandedEdges(parsed.data))
      toast.success(`Version ${v.version_number} is in the editor. Deploy to make it live.`)
      onOpenChange(false)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>Each Deploy saves a version. Restore one to bring it back into the editor.</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 px-4 pb-6">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!loading && versions.length === 0 && <p className="text-sm text-muted-foreground">No versions yet. The first Deploy creates one.</p>}
          {versions.map((v) => (
            <div key={v.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Version {v.version_number}</p>
                <p className="text-sm text-foreground">{v.commit_message || 'No message'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{when(v.created_at)}{v.created_by_email ? ` · ${v.created_by_email}` : ''}</p>
              </div>
              <Button variant="outline" size="sm" disabled={busyId !== null} onClick={() => restore(v)}>
                {busyId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Restore'}
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
