'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FlaskConical, Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Session } from './SessionCard'
import { SessionsTable } from './SessionsTable'
import { cn } from '@/lib/utils'

type TopTab = 'forge' | 'persona' | 'testcases'

interface Props {
  projectId: string
  agentId: string
}

export function SessionsList({ projectId, agentId }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<TopTab>('forge')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/prompt-forge/sessions?agent_id=${agentId}&project_id=${projectId}`)
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setError('Failed to load sessions'); setLoading(false) })
  }, [agentId, projectId])

  async function handleNewSession() {
    setCreating(true)
    try {
      const res = await fetch('/api/prompt-forge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, project_id: projectId }),
      })
      const session = await res.json()
      if (session?.id) router.push(`/${projectId}/agents/${agentId}/prompt-forge/${session.id}`)
    } catch { setError('Failed to create session') }
    finally { setCreating(false) }
  }

  async function handleRename(session: Session, newName: string) {
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, name: newName } : s))
    await fetch(`/api/prompt-forge/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/prompt-forge/sessions/${deleteTarget.id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch { setError('Failed to delete') }
    finally { setDeleting(false) }
  }

  const TABS: { key: TopTab; label: string; soon?: boolean }[] = [
    { key: 'forge', label: 'Forge' },
    { key: 'persona', label: 'Persona', soon: true },
    { key: 'testcases', label: 'Test Cases', soon: true },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Navbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/${projectId}/agents/${agentId}`)}
              className="w-9 h-9 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <FlaskConical className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Prompt Forge</h1>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium rounded-full">Beta</Badge>
            </div>
          </div>
          {tab === 'forge' && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleNewSession} disabled={creating}>
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              New session
            </Button>
          )}
        </div>

        {/* Tab row */}
        <div className="max-w-5xl mx-auto px-6 flex items-center">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => !t.soon && setTab(t.key)}
              disabled={t.soon}
              className={cn(
                'flex items-center gap-1.5 px-3 h-9 text-xs font-medium border-b-2 transition-colors',
                tab === t.key
                  ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-gray-400 dark:text-gray-600',
                t.soon ? 'cursor-not-allowed opacity-50' : 'hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {t.label}
              {t.soon && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-medium rounded-full">
                  Soon
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Coming soon */}
      {tab !== 'forge' && (
        <div className="flex items-center justify-center py-40">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-400 mb-1">
              {tab === 'persona' ? 'Persona' : 'Test Cases'}
            </p>
            <p className="text-xs text-gray-600">Coming soon</p>
          </div>
        </div>
      )}

      {/* Forge content */}
      {tab === 'forge' && (
        <div className="max-w-4xl mx-auto px-10 py-10">
          {error && <p className="text-xs text-red-400 mb-4">{error}</p>}
          <SessionsTable
            sessions={sessions}
            loading={loading}
            creating={creating}
            renamingId={renamingId}
            onNavigate={id => router.push(`/${projectId}/agents/${agentId}/prompt-forge/${id}`)}
            onRename={handleRename}
            onRenameStart={id => setRenamingId(id)}
            onRenameEnd={() => setRenamingId(null)}
            onDeleteStart={session => setDeleteTarget(session)}
            onNewSession={handleNewSession}
          />
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-gray-100">Delete session</DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Delete{' '}
              <span className="font-medium text-gray-200">"{deleteTarget?.name || 'Untitled session'}"</span>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" className="h-8 text-xs border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" className="h-8 text-xs gap-1.5" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-3 h-3 animate-spin" />}Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}