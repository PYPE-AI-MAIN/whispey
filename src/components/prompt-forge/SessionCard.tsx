'use client'

import { Calendar, Clock, Cpu, MoreHorizontal, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InlineNameEditor } from './InlineNameEditor'
import { cn } from '@/lib/utils'

export interface Session {
  id: string
  name: string
  messages: any[]
  system_prompt: string
  model: string | null
  provider: string | null
  created_at: string
  updated_at: string
}

interface Props {
  session: Session
  renamingId: string | null
  onNavigate: (id: string) => void
  onRename: (session: Session, name: string) => void
  onRenameStart: (id: string) => void
  onRenameEnd: () => void
  onDeleteStart: (session: Session) => void
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

function formatAbsolute(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function SessionCard({
  session, renamingId, onNavigate, onRename, onRenameStart, onRenameEnd, onDeleteStart,
}: Props) {
  const turnCount = session.messages?.length ?? 0

  return (
    <div
      onClick={() => onNavigate(session.id)}
      className={cn(
        'group flex items-center gap-4 px-5 py-4 cursor-pointer',
        'bg-gray-900 border border-gray-800',
        'hover:bg-gray-800/70 hover:border-gray-700',
        'rounded-xl transition-all duration-150',
      )}
    >
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
        <MessageSquare className="w-4 h-4 text-violet-400" />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="mb-1.5">
          <InlineNameEditor
            name={session.name || 'Untitled session'}
            onSave={name => onRename(session, name)}
            forceEdit={renamingId === session.id}
            onForceEditDone={onRenameEnd}
          />
        </div>
        <div className="flex items-center gap-2.5">
          <MetaPill icon={<Clock className="w-3 h-3" />} label={formatRelative(session.updated_at)} />
          <MetaDivider />
          <MetaPill icon={<Calendar className="w-3 h-3" />} label={formatAbsolute(session.created_at)} />
          <MetaDivider />
          <MetaPill icon={<Cpu className="w-3 h-3" />} label={session.model ?? 'default'} />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700 tabular-nums">
          {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <button
              aria-label="Session options"
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-all"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36 bg-gray-900 border-gray-700">
            <DropdownMenuItem
              onClick={e => { e.stopPropagation(); onRenameStart(session.id) }}
              className="text-xs text-gray-300 focus:bg-gray-800 focus:text-gray-100 gap-2 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-800" />
            <DropdownMenuItem
              onClick={e => { e.stopPropagation(); onDeleteStart(session) }}
              className="text-xs text-red-400 focus:bg-red-900/20 focus:text-red-300 gap-2 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function MetaPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[12px] text-gray-500">
      {icon}{label}
    </span>
  )
}

function MetaDivider() {
  return <span className="w-px h-3 bg-gray-700 flex-shrink-0" />
}