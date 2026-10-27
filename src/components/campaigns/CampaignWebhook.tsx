'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Loader2, Plus, Trash2, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MAX_CAMPAIGN_WEBHOOKS } from '@/utils/campaigns/constants'
import type { CampaignWebhookEntry, CampaignWebhooks, CampaignWebhookSend } from '@/utils/campaigns/constants'

const HELP = 'Called once automatically when the campaign completes. You can also send it manually at any time. Your endpoint should reply with a 2xx status.'
const TOKEN_HINT = 'Optional, sent as Authorization: Bearer <token>'
const HTTPS = /^https:\/\/\S+$/i

export const webhookUrlError = (url: string) => (url.trim() && !HTTPS.test(url.trim()) ? 'Must be an https:// URL' : undefined)

type Note = { ok: boolean; text: string }

async function runTest(body: Record<string, unknown>): Promise<Note> {
  try {
    const res = await fetch('/api/campaigns/webhook/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, text: data.error || 'Test failed' }
    if (data.ok) return { ok: true, text: `Reached your endpoint (HTTP ${data.httpCode})` }
    return { ok: false, text: data.error || 'No response from your endpoint' }
  } catch {
    return { ok: false, text: 'Test failed' }
  }
}

function NoteLine({ note }: Readonly<{ note: Note | null }>) {
  if (!note) return null
  return <p className={`text-xs ${note.ok ? 'text-success' : 'text-destructive'}`}>{note.text}</p>
}

// ─── Create page: optional, collapsed by default ─────────────────────────────

export type WebhookDraft = { url: string; token: string }

interface WebhookCreateSectionProps {
  projectId: string
  webhooks: WebhookDraft[]
  onChange: (webhooks: WebhookDraft[]) => void
}

export function WebhookCreateSection({ projectId, webhooks, onChange }: Readonly<WebhookCreateSectionProps>) {
  const tokenError = (token: string) => (token.length > 1024 ? 'Token is too long' : undefined)
  const hasInvalid = webhooks.some((w) => webhookUrlError(w.url) || tokenError(w.token))
  const [open, setOpen] = useState(webhooks.some((w) => w.url))
  const [testing, setTesting] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, Note>>({})

  // Always at least one (possibly empty) row while open, so there is something to type into.
  const rows = webhooks.length ? webhooks : [{ url: '', token: '' }]
  const update = (i: number, patch: Partial<WebhookDraft>) => {
    onChange(rows.map((w, j) => (j === i ? { ...w, ...patch } : w)))
    setNotes(({ [i]: _drop, ...rest }) => rest)
  }
  const remove = (i: number) => { onChange(rows.filter((_, j) => j !== i)); setNotes({}) }
  const test = async (i: number) => {
    setTesting(i)
    const note = await runTest({ projectId, url: rows[i].url.trim(), token: rows[i].token.trim() })
    setNotes((n) => ({ ...n, [i]: note }))
    setTesting(null)
  }

  return (
    <div className="border border-border rounded-lg bg-muted/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-foreground" />
          <span className="text-sm font-semibold text-foreground">Completion Webhooks</span>
          <span className="text-xs text-muted-foreground">Optional</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Stays open while a URL is invalid, so the error that blocks Send is never hidden. */}
      {(open || hasInvalid) && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">{HELP}</p>
          {rows.map((w, i) => {
            const error = webhookUrlError(w.url)
            return (
              <div key={i} /* NOSONAR: drafts have no id until saved */ className="p-3 border border-border rounded-md bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`webhook-url-${i}`} className="text-xs font-medium text-muted-foreground">Webhook URL</Label>
                  {(rows.length > 1 || w.url || w.token) && (
                    <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remove this webhook">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Input
                  id={`webhook-url-${i}`}
                  value={w.url}
                  onChange={(e) => update(i, { url: e.target.value })}
                  placeholder="https://your-workflow.example.com/webhook/..."
                  className="h-8 text-xs"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Input
                  type="password"
                  autoComplete="off"
                  aria-label="Token"
                  value={w.token}
                  onChange={(e) => update(i, { token: e.target.value })}
                  placeholder={TOKEN_HINT}
                  className="h-8 text-xs"
                />
                {tokenError(w.token) && <p className="text-xs text-destructive">{tokenError(w.token)}</p>}
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => test(i)} disabled={!w.url.trim() || Boolean(error) || testing !== null}>
                    {testing === i && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                    Send test
                  </Button>
                  <NoteLine note={notes[i] ?? null} />
                </div>
              </div>
            )
          })}
          {rows.length < MAX_CAMPAIGN_WEBHOOKS && rows.at(-1)?.url.trim() && (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([...rows, { url: '', token: '' }])}>
              <Plus className="w-3 h-3 mr-1" /> Add another webhook
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Campaign page / details sheet: list with status and actions ─────────────

const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

const deliveredCount = (w: CampaignWebhookEntry) => w.history.filter((h) => h.outcome === 'sent').length

const TONE = {
  muted: { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
  success: { text: 'text-success', dot: 'bg-success' },
  danger: { text: 'text-destructive', dot: 'bg-destructive' },
  warning: { text: 'text-warning', dot: 'bg-warning' },
}

function describe(w: CampaignWebhookEntry, campaignDone: boolean): { label: string; detail?: string; tone: keyof typeof TONE } {
  const who = (h: { trigger: string | null; by: string | null }) => (h.trigger === 'completed' ? 'automatically' : `by ${h.by}`)
  switch (w.status) {
    case 'pending':
      return campaignDone
        ? { label: 'Not sent', detail: 'Added after completion', tone: 'muted' }
        : { label: 'Scheduled', detail: 'Sends when the campaign completes', tone: 'muted' }
    case 'sending':
      return { label: 'Sending…', tone: 'muted' }
    case 'sent':
      return { label: 'Sent', detail: `${formatWhen(w.sentAt)} · ${who(w)}`, tone: 'success' }
    case 'failed':
      return { label: 'Failed', detail: w.lastError ?? undefined, tone: 'danger' }
    case 'unconfirmed':
      return { label: 'Unconfirmed', detail: `${w.lastError ?? 'No response'}; it may have arrived`, tone: 'warning' }
  }
}

type Action = { label: string; mode: 'send' | 'force'; confirm?: string }

/**
 * Manual sends are never blocked: the button only changes its wording and warns
 * when the webhook already went out. ('force' names the claim the user saw, so a
 * double click still sends once.)
 */
function actionFor(w: CampaignWebhookEntry, campaignDone: boolean): Action | null {
  if (w.status === 'sending') return null
  const times = deliveredCount(w)
  const mode = w.status === 'sent' || w.status === 'unconfirmed' ? 'force' : 'send'
  if (times > 0 || w.status === 'unconfirmed') {
    const count = times === 1 ? 'once' : `${times} times`
    let already = 'The last send may already have reached your workflow.'
    if (times > 0) already = `This webhook was already sent ${count}, last on ${formatWhen(w.sentAt)}.`
    return { label: 'Send again', mode, confirm: `${already} Send it again? Your workflow will run again.` }
  }
  if (w.status === 'failed') return { label: 'Retry', mode }
  return campaignDone
    ? { label: 'Send now', mode }
    : { label: 'Send now', mode, confirm: 'Send this webhook now? It will then not be sent again automatically when the campaign completes.' }
}

const OUTCOME_LABEL = { sent: 'Delivered', failed: 'Not delivered', unconfirmed: 'Unconfirmed' } as const
const OUTCOME_TONE_KEY = { sent: 'success', failed: 'danger', unconfirmed: 'warning' } as const
const OUTCOME_TONE = { sent: 'text-success', failed: 'text-destructive', unconfirmed: 'text-warning' } as const

const TRIGGER_LABEL = { completed: 'Automatic · on completion', manual: 'Manual', forced: 'Manual · send again' } as const

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2 items-baseline">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 font-mono text-[11px] text-foreground break-all">{children}</span>
    </div>
  )
}

/** Every send, newest first, with exactly what was sent where and what came back. */
function History({ sends }: Readonly<{ sends: CampaignWebhookSend[] }>) {
  if (!sends.length) return <p className="text-xs text-muted-foreground">No sends yet.</p>
  return (
    <ol className="space-y-3">
      {sends.map((h, i) => (
        <li key={`${h.at}-${i}`} className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1.5 font-medium ${OUTCOME_TONE[h.outcome]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${TONE[OUTCOME_TONE_KEY[h.outcome]].dot}`} />
              {OUTCOME_LABEL[h.outcome]}{h.httpCode ? ` · HTTP ${h.httpCode}` : ''}
            </span>
            <span className="ml-auto text-muted-foreground tabular-nums">{formatWhen(h.at)}</span>
          </div>
          <Field label="Trigger">{TRIGGER_LABEL[h.trigger]}{h.trigger === 'completed' ? '' : ` · ${h.by}`}</Field>
          {h.url && <Field label="URL">{h.url}</Field>}
          <Field label="Token">
            {h.token ?? (h.hasToken
              ? <span className="font-sans text-muted-foreground">Used (hidden)</span>
              : <span className="font-sans text-muted-foreground">None</span>)}
          </Field>
          {h.attempts > 1 && <Field label="Attempts">{h.attempts}</Field>}
          {(h.response || h.error) && (
            <div className="space-y-1">
              <span className="text-muted-foreground">Response</span>
              <pre className="p-2 rounded bg-card border border-border font-mono text-[11px] text-foreground whitespace-pre-wrap break-all max-h-32 overflow-auto">{h.response || h.error}</pre>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

function HistoryDialog({ campaignId, webhook, onClose }: Readonly<{ campaignId: string; webhook: CampaignWebhookEntry | null; onClose: () => void }>) {
  // Loaded only when opened: it carries the tokens, which the page list never does.
  const { data, isLoading, error } = useQuery<{ token: string; history: CampaignWebhookSend[] }>({
    queryKey: ['campaign-webhook-detail', campaignId, webhook?.id, webhook?.history.length],
    enabled: Boolean(webhook),
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/webhook/token?id=${encodeURIComponent(webhook!.id)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load history')
      return json
    },
    retry: false,
  })
  return (
    <Dialog open={Boolean(webhook)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        {webhook && (
          <>
            <DialogHeader>
              <DialogTitle>Send history</DialogTitle>
              <DialogDescription className="text-xs font-mono break-all">{webhook.url}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
              {isLoading && <Skeleton className="h-24 w-full" />}
              {/* Without edit rights the full history (with tokens) is refused: show the token-free one. */}
              {error && <p className="text-xs text-muted-foreground mb-3">Tokens are hidden for your role.</p>}
              {data && <History sends={data.history} />}
              {error && <History sends={webhook.history} />}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

type Editing = { id: string; url: string; token: string; loadingToken: boolean; tokenFailed: boolean }

// className sets padding/grid placement to match the surrounding cards (the details sheet uses roomier ones).
export function CampaignWebhookCard({ campaignId, className = 'p-4 sm:p-6' }: Readonly<{ campaignId: string; className?: string }>) {
  const queryClient = useQueryClient()
  const queryKey = ['campaign-webhook', campaignId]
  const [editing, setEditing] = useState<Editing | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, Note>>({})
  const [historyOpen, setHistoryOpen] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useQuery<CampaignWebhooks>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/webhook`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load webhooks')
      return json.webhook
    },
    // Keep polling only while a send is in flight.
    refetchInterval: (query) => (query.state.data?.webhooks.some((w) => w.status === 'sending') ? 5000 : false),
    retry: false,
  })

  const note = (key: string, value: Note | null) =>
    setNotes(({ [key]: _old, ...rest }) => (value ? { ...rest, [key]: value } : rest))

  const call = async (key: string, path: string, method: string, body: unknown) => {
    setBusy(key)
    note(key, null)
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/webhook${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.webhook) queryClient.setQueryData(queryKey, json.webhook)
      if (!res.ok) note(key, { ok: false, text: json.error || 'Something went wrong' })
      return res.ok
    } catch {
      note(key, { ok: false, text: 'Something went wrong' })
      return false
    } finally {
      setBusy(null)
    }
  }

  const card = `rounded-xl border border-border bg-card shadow-sm flex flex-col ${className}`
  const title = (
    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
      <Webhook className="w-3.5 h-3.5" /> Completion Webhooks
    </span>
  )

  if (isLoading) return <div className={card}><h4 className="mb-4">{title}</h4><Skeleton className="h-5 w-40" /></div>
  if (isError || !data) {
    return (
      <div className={card}>
        <h4 className="mb-4">{title}</h4>
        <p className="text-sm text-muted-foreground">{error?.message || 'Webhook settings are unavailable right now.'}</p>
      </div>
    )
  }

  const campaignDone = data.campaignStatus === 'completed'
  const canAdd = data.webhooks.length < MAX_CAMPAIGN_WEBHOOKS
  const startEdit = async (w?: CampaignWebhookEntry) => {
    const id = w?.id ?? 'new'
    setEditing({ id, url: w?.url ?? '', token: '', loadingToken: Boolean(w?.hasToken), tokenFailed: false })
    note(id, null)
    if (!w?.hasToken) return
    // Fetched only when the dialog opens; the campaign page itself never holds tokens.
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/webhook/token?id=${encodeURIComponent(w.id)}`)
      const json = await res.json()
      setEditing((e) => (e?.id === id ? { ...e, token: res.ok ? json.token ?? '' : '', loadingToken: false, tokenFailed: !res.ok } : e))
      if (!res.ok) note(id, { ok: false, text: json.error || 'Could not load the saved token' })
    } catch {
      setEditing((e) => (e?.id === id ? { ...e, loadingToken: false, tokenFailed: true } : e))
      note(id, { ok: false, text: 'Could not load the saved token' })
    }
  }

  const renderForm = (w?: CampaignWebhookEntry) => {
    if (!editing) return null
    const key = editing.id
    const urlError = webhookUrlError(editing.url)
    const placeholder = editing.loadingToken ? 'Loading saved token…' : 'Paste a token'

    const save = async () => {
      // The field holds the real saved token, so send exactly what is there ('' clears it).
      // If the saved token could not be loaded, an empty field means "unchanged", never "clear".
      const typed = editing.token.trim()
      const token = editing.tokenFailed && !typed ? undefined : typed
      const body = w ? { action: 'update', id: w.id, url: editing.url.trim(), token } : { action: 'add', url: editing.url.trim(), token }
      if (await call(key, '', 'PUT', body)) setEditing(null)
    }
    const remove = async () => {
      if (!w || !globalThis.confirm('Delete this webhook?')) return
      if (await call(key, '', 'PUT', { action: 'remove', id: w.id })) setEditing(null)
    }
    const test = async () => {
      setBusy(key)
      note(key, await runTest({
        campaignId,
        webhookId: w?.id,
        url: editing.url.trim(),
        token: editing.token.trim(),
      }))
      setBusy(null)
    }

    return (
      <>
        <DialogHeader>
          <DialogTitle>{w ? 'Edit webhook' : 'Add webhook'}</DialogTitle>
          <DialogDescription className="text-xs">{HELP}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor={`edit-webhook-url-${key}`} className="text-xs font-medium text-muted-foreground mb-1.5 block">Webhook URL</Label>
            <Input
              id={`edit-webhook-url-${key}`}
              value={editing.url}
              onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              placeholder="https://your-workflow.example.com/webhook/..."
              className="h-9 text-sm"
              autoFocus
            />
            {urlError && <p className="text-xs text-destructive mt-1">{urlError}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor={`edit-webhook-token-${key}`} className="text-xs font-medium text-muted-foreground">Token <span className="font-normal">(optional)</span></Label>
            </div>
            <Input
              id={`edit-webhook-token-${key}`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={editing.token}
              disabled={editing.loadingToken}
              onChange={(e) => setEditing({ ...editing, token: e.target.value })}
              placeholder={placeholder}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Sent as Authorization: Bearer &lt;token&gt;</p>
          </div>
          <NoteLine note={notes[key] ?? null} />
        </div>
        <DialogFooter className="flex-row sm:justify-between gap-2">
          <div>
            {w?.editable && (
              <Button type="button" variant="ghost" size="sm" className="h-9 text-xs text-destructive hover:text-destructive" onClick={remove} disabled={busy !== null}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={test} disabled={busy !== null || editing.loadingToken || !editing.url.trim() || Boolean(urlError)}>
              Send test
            </Button>
            <Button type="button" size="sm" className="h-9 text-xs" onClick={save} disabled={busy !== null || editing.loadingToken || !editing.url.trim() || Boolean(urlError)}>
              {busy === key && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}Save
            </Button>
          </div>
        </DialogFooter>
      </>
    )
  }

  const runAction = async (w: CampaignWebhookEntry, action: Action) => {
    if (action.confirm && !globalThis.confirm(action.confirm)) return
    await call(w.id, '/send', 'POST', { id: w.id, mode: action.mode, expectClaimId: action.mode === 'force' ? w.claimId : undefined })
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3">
        <h4>{title}</h4>
        {canAdd && data.webhooks.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-6 -my-1 -mr-2 px-2 text-xs" onClick={() => startEdit()} disabled={busy !== null || editing !== null}>
            <Plus className="w-3 h-3 mr-1" /> Add webhook
          </Button>
        )}
      </div>

      {data.webhooks.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-4">
          <p className="text-sm text-foreground">No webhooks yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">A webhook is called when this campaign completes. You can also send it manually.</p>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs mt-1" onClick={() => startEdit()}>
            <Plus className="w-3 h-3 mr-1" /> Add webhook
          </Button>
        </div>
      )}

      <div className="divide-y divide-border/60">
        {data.webhooks.map((w) => {
          const state = describe(w, campaignDone)
          const tone = TONE[state.tone]
          const action = actionFor(w, campaignDone)
          return (
            <div key={w.id} className="py-3 first:pt-0 last:pb-0" data-webhook-id={w.id}>
              <div className="flex items-center gap-3">
                <p className="flex-1 min-w-0 truncate text-sm font-medium text-foreground" title={w.url}>{w.url.replace(/^https:\/\//, '')}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {action && (
                    <Button
                      type="button"
                      size="sm"
                      variant={action.label === 'Send again' ? 'outline' : 'default'}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => runAction(w, action)}
                      disabled={busy !== null}
                    >
                      {busy === w.id && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                      {action.label}
                    </Button>
                  )}
                  {/* Once sent, the URL is part of the history and is frozen (send again, or add another webhook). */}
                  {w.editable && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => startEdit(w)} disabled={busy !== null || editing !== null}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs min-w-0">
                <span className={`inline-flex items-center gap-1.5 font-medium shrink-0 ${tone.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {state.label}
                </span>
                {state.detail && <span className="text-muted-foreground truncate min-w-0" title={state.detail}>{state.detail}</span>}
                {w.history.length > 0 && (
                  <button
                    type="button"
                    className="ml-auto shrink-0 text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                    onClick={() => setHistoryOpen(w.id)}
                  >
                    History ({w.history.length})
                  </button>
                )}
              </div>
              <NoteLine note={notes[w.id] ?? null} />
            </div>
          )
        })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && busy === null) { setEditing(null); setNotes({}) } }}>
        <DialogContent className="sm:max-w-lg">
          {editing && renderForm(data.webhooks.find((w) => w.id === editing.id))}
        </DialogContent>
      </Dialog>

      {/* History opens in its own dialog so the card keeps the same height as Campaign Information. */}
      <HistoryDialog
        campaignId={campaignId}
        webhook={data.webhooks.find((x) => x.id === historyOpen) ?? null}
        onClose={() => setHistoryOpen(null)}
      />
    </div>
  )
}
