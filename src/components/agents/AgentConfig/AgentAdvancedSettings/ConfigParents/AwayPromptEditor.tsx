import React, { useState } from 'react'
import { AlertCircle, Info, Maximize2, RotateCcw } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AWAY_PROMPT_MAX_CHARS } from '@/config/agentDefaults'
import { useAwayDefaultPrompt } from '@/hooks/useAwayDefaultPrompt'
import { awayPromptToSave, isAwayPromptDirty } from '@/utils/awayPrompt'

interface AwayPromptEditorProps {
  /** The saved custom prompt; undefined means the agent uses the built-in default. */
  value?: string
  onChange: (value: string | undefined) => void
}

/**
 * Sidebar card + right-hand drawer for the Dynamic message prompt. The sidebar is too narrow to read or edit
 * a multi-thousand-character prompt, so the card only shows status and opens a full-height editor.
 */
export default function AwayPromptEditor({ value, onChange }: Readonly<AwayPromptEditorProps>) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string | null>(null) // null = untouched since opening
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const query = useAwayDefaultPrompt(open || !value) // the field previews the default when no custom prompt is saved
  const defaults = query.data
  const isCustom = Boolean(value)
  const initial = value ?? defaults?.prompt ?? ''
  const text = draft ?? initial
  const max = defaults?.max_chars ?? AWAY_PROMPT_MAX_CHARS
  const dirty = isAwayPromptDirty(draft, initial)
  const isBlank = text.trim() === ''
  const isDefaultText = defaults !== undefined && text.trim() === defaults.prompt.trim()
  const preview = (value ?? defaults?.prompt ?? '').replaceAll(/\s+/g, ' ').trim()
  const waitingForDefault = value === undefined && query.isLoading
  const defaultFailed = value === undefined && query.isError

  let previewNode = <Skeleton className="my-0.5 h-4 w-3/4" />
  if (preview) {
    previewNode = <span className="line-clamp-2 leading-5 text-muted-foreground">{preview}</span>
  } else if (defaultFailed) {
    previewNode = <span className="leading-5 text-muted-foreground">Built-in prompt (click to view)</span>
  }

  const openEditor = () => {
    setDraft(null)
    setConfirmDiscard(false)
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    setConfirmDiscard(false)
  }
  const requestClose = () => (dirty ? setConfirmDiscard(true) : close())
  const save = () => {
    if (isBlank) return
    onChange(awayPromptToSave(text, defaults?.prompt))
    close()
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-600 dark:text-gray-400">Dynamic Message Prompt</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-help text-gray-400" aria-label="About the dynamic message prompt" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">Instructions for writing a context-based message from the recent conversation.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isCustom && (
            <Badge variant="outline" className="ml-auto text-[10px] font-medium text-muted-foreground">
              Custom
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={openEditor}
          aria-label="Open dynamic message prompt editor"
          className="group relative block w-full rounded-md border border-input bg-transparent py-2 pl-3 pr-8 text-left text-xs shadow-xs transition-colors hover:border-ring/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {previewNode}
          <Maximize2
            className="absolute right-2.5 top-2.5 h-3 w-3 text-muted-foreground transition-colors group-hover:text-foreground"
            aria-hidden="true"
          />
        </button>
      </div>

      <Sheet open={open} onOpenChange={(next) => (next ? openEditor() : requestClose())}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border p-5 pr-12">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base">Dynamic message prompt</SheetTitle>
              <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
                {isCustom ? 'Custom' : 'Default'}
              </Badge>
            </div>
            <SheetDescription className="text-xs">
              Instructions for the context-based message sent when the caller goes quiet.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
            {defaultFailed && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
                <div className="flex-1">
                  <p>Couldn&apos;t load the default prompt. You can still write your own; leave it blank to keep the default.</p>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => query.refetch()}>
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {waitingForDefault ? (
              <Skeleton className="min-h-[240px] flex-1 rounded-lg" />
            ) : (
              <textarea
                aria-label="Dynamic message prompt"
                value={text}
                maxLength={max}
                spellCheck={false}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write the instructions for the message, or reset to the default."
                aria-invalid={isBlank}
                className="min-h-[240px] w-full flex-1 resize-none rounded-lg border border-input bg-muted/30 px-4 py-3 text-[13px] leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring/60 focus-visible:bg-transparent focus-visible:ring-1 focus-visible:ring-ring/30 aria-[invalid=true]:border-destructive/60"
              />
            )}

            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-destructive" role="alert">
                {isBlank && !waitingForDefault ? 'The prompt can’t be empty. Write one, or reset to the default.' : ''}
              </span>
              <span className={text.length >= max ? 'text-destructive' : 'text-muted-foreground'}>
                {text.length.toLocaleString()} / {max.toLocaleString()}
              </span>
            </div>
          </div>

          <SheetFooter className="border-t border-border p-4">
            {confirmDiscard ? (
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-xs">Discard your changes?</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDiscard(false)}>
                    Keep editing
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={close}>
                    Discard
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex w-full items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  disabled={!defaults || isDefaultText}
                  onClick={() => setDraft(defaults?.prompt ?? '')}
                >
                  <RotateCcw className="mr-1.5 h-3 w-3" aria-hidden="true" />
                  Reset to default
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={requestClose}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={save} disabled={isBlank || !dirty}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
