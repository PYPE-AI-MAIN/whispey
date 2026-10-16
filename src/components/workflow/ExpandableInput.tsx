'use client'

import React, { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** A one-line field that opens a larger box to read and edit long text, for the narrow side panel. */
export function ExpandableInput({
  value, onChange, placeholder, title,
}: Readonly<{ value: string; onChange: (value: string) => void; placeholder?: string; title: string }>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="relative min-w-0 flex-1">
        <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="h-7 pr-7 text-xs" />
        <button
          type="button"
          aria-label={`Expand ${title}`}
          title="Expand"
          onClick={() => setOpen(true)}
          className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Changes save as you type.</DialogDescription>
          </DialogHeader>
          <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-[220px] text-sm" autoFocus />
          <DialogFooter>
            <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
