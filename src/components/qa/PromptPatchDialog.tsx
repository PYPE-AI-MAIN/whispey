'use client'

/**
 * The suggested prompt change — Confluence "Automated Call QA — Design" §9.
 *
 * Shows ONLY the lines that change, never the whole prompt, because a diff
 * nobody can scan in ten seconds does not get read. The reviewer edits the
 * lines in place, adds their own, and publishes from here.
 *
 * Publishing goes through `POST /api/agents/[id]/history` — the same route the
 * Agent Config screen already uses — so the production-agent guard, the GitHub
 * push and the merge PR all behave exactly as they do today. This dialog only
 * produces the patched config; it never deploys anything itself.
 */
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

type Patch = { section: string; remove: string[]; add: string[]; why: string; issue_key: string | null; call_ids?: string[] }

export default function PromptPatchDialog({
  open, onOpenChange, insightId, agentId, patch, onPublished,
}: Readonly<{
  open: boolean
  onOpenChange: (v: boolean) => void
  insightId: string
  agentId: string
  patch: Patch
  onPublished: () => void
}>) {
  const { user } = useUser()
  const [removeLines, setRemoveLines] = useState<string[]>(patch.remove ?? [])
  const [addLines, setAddLines] = useState<string[]>(patch.add ?? [])
  const [commitMessage, setCommitMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])

  // reset whenever a different suggestion is opened
  useEffect(() => {
    if (!open) return
    setRemoveLines(patch.remove ?? [])
    setAddLines(patch.add ?? [])
    setCommitMessage(`QA: ${patch.why || 'prompt fix'}`.slice(0, 180))
    setError(null)
    setConflicts([])
  }, [open, patch])

  const publish = async () => {
    setBusy(true)
    setError(null)
    setConflicts([])

    try {
      // 1 — apply the (possibly edited) lines and get the patched config back
      const patchRes = await fetch(`/api/qa/insights/${insightId}/patch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          remove: removeLines.filter((l) => l.trim()),
          add: addLines.filter((l) => l.trim()),
        }),
      })
      const patched = await patchRes.json()

      if (!patchRes.ok) {
        setError(patched?.error || 'Could not apply that change')
        setConflicts(patched?.conflicts || [])
        return
      }

      // 2 — publish it the way every other prompt change is published
      const saveRes = await fetch(`/api/agents/${agentId}/history`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          config: patched.config,
          commit_message: commitMessage.trim() || 'QA prompt fix',
          userEmail: user?.primaryEmailAddress?.emailAddress,
          userId: user?.id,
        }),
      })
      const saved = await saveRes.json()

      if (!saveRes.ok) {
        setError(saved?.message || 'Could not save this version')
        return
      }

      // 3 — link the insight to the version, so the next one can say whether it worked
      await fetch(`/api/qa/insights/${insightId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'actioned', versionId: saved?.version?.id ?? saved?.id }),
      })

      onPublished()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const editLine = (list: string[], set: (v: string[]) => void, i: number, v: string) => {
    const next = [...list]
    next[i] = v
    set(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] sm:max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-none border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <DialogTitle>Suggested prompt change</DialogTitle>
          <DialogDescription>
            {patch.why || patch.section}
            {patch.call_ids?.length ? ` · from ${patch.call_ids.length} calls` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* the only scrolling region — Publish must never scroll out of reach */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* ---------------------------------------------------- removals */}
          {removeLines.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Replace these lines</p>
              <div className="space-y-2">
                {removeLines.map((line, i) => (
                  <div key={`r${i}`} className="flex items-start gap-2">
                    <span className="mt-2 font-mono text-sm text-red-500">−</span>
                    <Textarea
                      value={line}
                      onChange={(e) => editLine(removeLines, setRemoveLines, i, e.target.value)}
                      rows={2}
                      className="flex-1 border-red-200 bg-red-50 font-mono text-xs dark:border-red-900 dark:bg-red-950/30"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setRemoveLines(removeLines.filter((_, x) => x !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                These must match the live prompt exactly, give or take whitespace. If the prompt has
                changed since this was suggested, publishing will say so rather than guess.
              </p>
            </div>
          )}

          {/* ---------------------------------------------------- additions */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              {removeLines.length > 0 ? 'With these' : 'Add these lines'}
            </p>
            <div className="space-y-2">
              {addLines.map((line, i) => (
                <div key={`a${i}`} className="flex items-start gap-2">
                  <span className="mt-2 font-mono text-sm text-emerald-600">+</span>
                  <Textarea
                    value={line}
                    onChange={(e) => editLine(addLines, setAddLines, i, e.target.value)}
                    rows={2}
                    className="flex-1 border-emerald-200 bg-emerald-50 font-mono text-xs dark:border-emerald-900 dark:bg-emerald-950/30"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setAddLines(addLines.filter((_, x) => x !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddLines([...addLines, ''])}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add a line of your own
            </Button>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">What to call this version</p>
            <Input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} maxLength={180} />
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              <p className="font-medium text-amber-900 dark:text-amber-200">These lines are no longer in the prompt:</p>
              <ul className="mt-1.5 space-y-1">
                {conflicts.map((c) => (
                  <li key={c} className="font-mono text-xs text-amber-800 dark:text-amber-300">{c}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Edit them to match the prompt as it is now, or remove them and add your lines instead.
              </p>
            </div>
          )}

          {error && !conflicts.length && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-none border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={publish} disabled={busy || !addLines.some((l) => l.trim())}>
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Publish as a new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
