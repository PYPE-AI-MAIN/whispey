'use client'

import { FlaskConical, Loader2, Plus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SessionCard, Session } from './SessionCard'
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

export function SessionsTable({
  sessions, loading, creating, renamingId,
  onNavigate, onRename, onRenameStart, onRenameEnd, onDeleteStart, onNewSession,
}: Props) {
  if (loading) return <SessionsSkeleton />

  if (sessions.length === 0) return <EmptyState creating={creating} onNewSession={onNewSession} />

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Sessions
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {sessions.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            renamingId={renamingId}
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

function SessionsSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-2.5 w-12" />
      </div>
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4 bg-gray-900 border border-gray-800 rounded-xl"
          >
            <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-3.5 w-52 mb-2" />
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ creating, onNewSession }: { creating: boolean; onNewSession: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center mb-5">
        <FlaskConical className="w-6 h-6 text-gray-300 dark:text-gray-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
        No sessions yet
      </h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 max-w-[260px] leading-relaxed">
        Each session saves your prompt, variables, tools, and conversation — so you can iterate without losing previous work.
      </p>
      <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onNewSession} disabled={creating}>
        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        New session
      </Button>
    </div>
  )
}