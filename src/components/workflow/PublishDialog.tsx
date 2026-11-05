'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/** Deploy asks what changed, so the version history reads like a log instead of a list of dates. */
export function PublishDialog({ open, onOpenChange, onPublish, publishing }: Readonly<{
  open: boolean
  onOpenChange: (v: boolean) => void
  onPublish: (message: string) => void
  publishing: boolean
}>) {
  const [message, setMessage] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deploy your changes</DialogTitle>
          <DialogDescription>This makes them live for new calls and saves a version you can come back to.</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What changed? e.g. Added a callback path"
          className="min-h-[80px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>Cancel</Button>
          <Button onClick={() => onPublish(message.trim() || 'Workflow update')} disabled={publishing}>
            {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
