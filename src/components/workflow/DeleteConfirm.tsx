'use client'

import React, { useCallback, useState } from 'react'
import type { OnBeforeDelete } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useWorkflowStore } from '@/stores/workflowStore'

interface Pending {
  title: string
  detail: string
  resolve: (ok: boolean) => void
}

const UNDO_NOTE = 'You can undo this with Ctrl+Z until you deploy.'

function connectionsTitle(connections: number): string {
  if (connections === 1) return 'Delete this connection?'
  return `Delete ${connections} connections?`
}

function describe(stepNames: string[], connections: number): { title: string; detail: string } {
  if (stepNames.length === 0) return { title: connectionsTitle(connections), detail: UNDO_NOTE }
  if (stepNames.length > 1) return { title: `Delete ${stepNames.length} steps?`, detail: `Their ${connections} connections are removed too. ${UNDO_NOTE}` }
  const removed = connections === 1 ? 'Its 1 connection is' : `Its ${connections} connections are`
  return { title: `Delete "${stepNames[0]}"?`, detail: connections ? `${removed} removed too. ${UNDO_NOTE}` : UNDO_NOTE }
}

/**
 * Pressing Delete on the canvas asks first. Returns the canvas's `onBeforeDelete` and the dialog to render.
 * Enter confirms and Escape cancels.
 */
export function useDeleteConfirm(): { onBeforeDelete: OnBeforeDelete; dialog: React.ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null)

  const onBeforeDelete = useCallback<OnBeforeDelete>(async ({ nodes, edges }) => {
    if (!nodes.length && !edges.length) return false
    const workflow = useWorkflowStore.getState().workflow
    const names = nodes.map((n) => workflow?.nodes.find((w) => w.id === n.id)?.name || n.id)
    const { title, detail } = describe(names, edges.length)
    return new Promise<boolean>((resolve) => setPending({ title, detail, resolve }))
  }, [])

  const answer = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open) answer(false) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{pending?.title}</DialogTitle>
          <DialogDescription>{pending?.detail}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => answer(false)}>Cancel</Button>
          <Button variant="destructive" autoFocus onClick={() => answer(true)}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { onBeforeDelete, dialog }
}
