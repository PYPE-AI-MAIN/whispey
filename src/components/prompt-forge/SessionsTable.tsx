'use client'

import { useMemo, useState } from 'react'
import { FlaskConical, Loader2, Lock, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Session, formatAbsolute, formatRelative, lastMessage, modelName, sessionTitle } from './SessionCard'
import { InlineNameEditor } from './InlineNameEditor'
import { cn } from '@/lib/utils'

interface Props {
  sessions: Session[]
  loading: boolean
  creating: boolean
  renamingId: string | null
  onNavigate: (id: string) => void
  onRename: (session: Session, name: string) => void
  onRenameStart: (id: string) => void
  onRenameEnd: () => void
  onDeleteStart: (session: Session) => void
  onNewSession: () => void
}

type Scope = 'all' | 'mine' | 'team'
const SCOPE_LABELS: Record<Scope, string> = { all: 'All', mine: 'Mine', team: 'Team' }

const COLS = 'grid grid-cols-[minmax(260px,3fr)_minmax(120px,1.1fr)_80px_96px_minmax(200px,1.6fr)_88px_32px] items-center gap-4'

/** The agent's Prompt Forge sessions as one table: what each is, who owns it, how far it got. */
export function SessionsTable({
  sessions, loading, creating, renamingId,
  onNavigate, onRename, onRenameStart, onRenameEnd, onDeleteStart, onNewSession,
}: Props) {
  const [scope, setScope] = useState<Scope>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => ({
    all: sessions.length,
    mine: sessions.filter(s => s.is_mine).length,
    team: sessions.filter(s => !s.is_mine).length,
  }), [sessions])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessions
      .filter(s => scope === 'all' || (scope === 'mine' ? s.is_mine : !s.is_mine))
      .filter(s => !q || [sessionTitle(s).title, s.name, s.owner_email ?? '', s.model ?? ''].some(v => v?.toLowerCase().includes(q)))
  }, [sessions, scope, query])

  if (loading) return <SessionsSkeleton />
  if (sessions.length === 0) return <EmptyState creating={creating} onNewSession={onNewSession} />

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
        Test this agent&apos;s prompt in text before it goes live. Each session is a draft — change the prompt, model, greeting or tools and chat with it.{' '}
        <span className="text-muted-foreground">Save keeps a version (prompt + conversation) you can share; only the person who created a session can change it.</span>
      </p>

      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-border bg-card p-0.5" role="tablist">
          {(['all', 'mine', 'team'] as Scope[]).map(s => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={cn('rounded-md px-3 h-7 text-xs font-medium transition-colors',
                scope === s ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {SCOPE_LABELS[s]} <span className="ml-0.5 text-muted-foreground tabular-nums">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, owner or model"
            className="w-full h-8 rounded-lg border border-border bg-card pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className={cn(COLS, 'px-4 h-9 border-b border-border text-[11px] font-medium text-muted-foreground')}>
          <span>Session</span><span>Model</span><span>Messages</span><span>Versions</span><span>Owner</span><span>Updated</span><span />
        </div>
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">No sessions match.</p>
        ) : shown.map(s => (
          <SessionRow
            key={s.id}
            session={s}
            renaming={renamingId === s.id}
            onNavigate={onNavigate}
            onRename={onRename}
            onRenameStart={onRenameStart}
            onRenameEnd={onRenameEnd}
            onDeleteStart={onDeleteStart}
          />
        ))}
      </div>
    </div>
  )
}

function SessionRow({ session, renaming, onNavigate, onRename, onRenameStart, onRenameEnd, onDeleteStart }: Readonly<{
  session: Session; renaming: boolean
  onNavigate: (id: string) => void; onRename: (s: Session, name: string) => void
  onRenameStart: (id: string) => void; onRenameEnd: () => void; onDeleteStart: (s: Session) => void
}>) {
  const { title, fromPrompt } = sessionTitle(session)
  const preview = lastMessage(session)
  const messages = (session.messages ?? []).filter((m: any) => m?.role === 'user').length
  const versions = session.version_count ?? 0
  const email = session.owner_email
  return (
    // Not a <button>: it holds the rename editor and the options menu. An invisible
    // full-size button behind the content is the click target instead.
    <div className={cn(COLS, 'group relative px-4 py-3 border-b last:border-b-0 border-border/60 hover:bg-muted/50 transition-colors')}>
      <button type="button" aria-label={`Open ${title}`} onClick={() => onNavigate(session.id)} className="absolute inset-0 z-0 cursor-pointer" />

      <div className="relative z-10 pointer-events-none min-w-0">
        <div className="pointer-events-auto w-fit max-w-full">
          {renaming ? (
            <InlineNameEditor name={session.name || 'Untitled session'} onSave={name => onRename(session, name)} forceEdit onForceEditDone={onRenameEnd} />
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate">
              <span className="truncate">{title}</span>
              {fromPrompt && <span className="shrink-0 text-[10px] font-normal text-muted-foreground">unnamed</span>}
              {session.can_edit === false && <Lock className="w-3 h-3 shrink-0 text-muted-foreground" aria-label="Read-only — not your session" />}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">
          {preview ? <><span className="text-muted-foreground">{preview.who}:</span> {preview.text}</> : <span className="italic">No conversation yet</span>}
        </p>
      </div>

      <span className="relative z-10 pointer-events-none text-xs text-muted-foreground truncate">{modelName(session.provider, session.model)}</span>
      <span className="relative z-10 pointer-events-none text-xs text-muted-foreground tabular-nums">{messages}</span>
      <span className={cn('relative z-10 pointer-events-none text-xs tabular-nums', versions ? 'text-muted-foreground' : 'text-muted-foreground')}>
        {versions ? `${versions} saved` : 'Not saved'}
      </span>

      <span className="relative z-10 pointer-events-none flex items-center gap-2 min-w-0" title={email ?? undefined}>
        <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold uppercase',
          session.is_mine ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
          {email ? email[0] : '?'}
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {email ?? <span className="text-muted-foreground">Unknown (older session)</span>}
          {session.is_mine && <span className="ml-1 text-muted-foreground">· you</span>}
        </span>
      </span>

      <span className="relative z-10 pointer-events-none text-xs text-muted-foreground" title={`Created ${formatAbsolute(session.created_at)}`}>
        {formatRelative(session.updated_at)}
      </span>

      <div className="relative z-10 flex justify-end">
        {session.can_edit !== false && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Session options" className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-all">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onRenameStart(session.id)} className="text-xs gap-2 cursor-pointer"><Pencil className="w-3.5 h-3.5" />Rename</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDeleteStart(session)} className="text-xs gap-2 cursor-pointer text-destructive focus:text-destructive"><Trash2 className="w-3.5 h-3.5" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

// Placeholder rows while sessions load; static ids so they key stably.
const SKELETON_ROWS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5']

function SessionsSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {SKELETON_ROWS.map(id => (
        <div key={id} className={cn(COLS, 'px-4 py-3.5 border-b last:border-b-0 border-border/60')}>
          <div><Skeleton className="h-3.5 w-56 mb-2" /><Skeleton className="h-2.5 w-72" /></div>
          <Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-6" /><Skeleton className="h-3 w-14" />
          <div className="flex items-center gap-2"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-3 w-32" /></div>
          <Skeleton className="h-3 w-12" /><span />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ creating, onNewSession }: { creating: boolean; onNewSession: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center mb-5">
        <FlaskConical className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-2">No sessions yet</h3>
      <p className="text-xs text-muted-foreground mb-6 max-w-[300px] leading-relaxed">
        Test this agent&apos;s prompt in text before it goes live. A session keeps your prompt, model, greeting, tools and conversation; Save adds a version you can share.
      </p>
      <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onNewSession} disabled={creating}>
        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        New session
      </Button>
    </div>
  )
}
