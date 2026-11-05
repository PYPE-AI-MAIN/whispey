'use client'

import { useState } from 'react'
import { CheckCircle2, LifeBuoy, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HELP_CATEGORIES, MAX_HELP_MESSAGE, type HelpCategory } from '@/lib/helpRequests'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; ref: string } | { kind: 'error'; message: string }

/**
 * "Ask Pype for help" — for a client who built an agent through the MCP and
 * got stuck. Sends the request (with the agent attached) to the Pype team.
 */
export function AskPypeForHelp({ agentId }: Readonly<{ agentId: string }>) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<HelpCategory>('stuck_building')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const reset = () => {
    setCategory('stuck_building')
    setMessage('')
    setStatus({ kind: 'idle' })
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && status.kind === 'sent') reset()
  }

  const submit = async () => {
    setStatus({ kind: 'sending' })
    try {
      const res = await fetch(`/api/agents/${agentId}/help-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ kind: 'error', message: data?.error || 'Could not send your request. Please try again.' })
        return
      }
      setStatus({ kind: 'sent', ref: data.jira_key || '' })
    } catch {
      setStatus({ kind: 'error', message: 'Could not reach Pype. Check your connection and try again.' })
    }
  }

  const tooShort = message.trim().length < 10
  const sending = status.kind === 'sending'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
      >
        <LifeBuoy className="h-3.5 w-3.5 text-primary" />
        Ask Pype for help
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          {status.kind === 'sent' ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <DialogTitle>Request sent</DialogTitle>
              <DialogDescription>
                The Pype team has your request and this agent&apos;s details, and will get back to you by email.
                {status.ref ? ` Reference: ${status.ref}` : ''}
              </DialogDescription>
              <Button className="mt-2 cursor-pointer" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Ask Pype for help</DialogTitle>
                <DialogDescription>
                  Tell us where you&apos;re stuck. This agent is attached automatically, so we can look at it directly.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="help-category" className="text-sm font-medium text-foreground">
                    What do you need?
                  </label>
                  <select
                    id="help-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as HelpCategory)}
                    disabled={sending}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                  >
                    {HELP_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="help-message" className="text-sm font-medium text-foreground">
                    Details
                  </label>
                  <textarea
                    id="help-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={sending}
                    maxLength={MAX_HELP_MESSAGE}
                    rows={6}
                    placeholder="What were you trying to do, and what happened instead?"
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {status.kind === 'error' && (
                  <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                    {status.message}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button className="cursor-pointer" onClick={submit} disabled={tooShort || sending}>
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send to Pype
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
