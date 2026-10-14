'use client'

// Pi's own two-column shell: a collapsible session rail plus the chat pane.
// Lives inside SidebarWrapper, so it only fills the height that already gives it.

import { useEffect, useMemo, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, PanelLeftClose, PanelLeft } from 'lucide-react'
import PiLoading from '@/components/pi/PiLoading'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface SessionRow {
  id: string
  title: string
  user_email: string
  created_at: string
  updated_at: string
  message_count: number
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? 'Request failed')
  return data
}

function SessionRowItem({
  session,
  isActive,
  projectId,
  showEmail,
  canManage,
}: Readonly<{ session: SessionRow; isActive: boolean; projectId: string; showEmail: boolean; canManage: boolean }>) {
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(session.title)

  const rename = useMutation({
    mutationFn: (newTitle: string) => fetchJson(`/api/pi/sessions/${session.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pi-sessions', projectId] }),
  })
  const remove = useMutation({
    mutationFn: () => fetchJson(`/api/pi/sessions/${session.id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pi-sessions', projectId] }),
  })

  if (renaming) {
    return (
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { setRenaming(false); if (title.trim() && title !== session.title) rename.mutate(title.trim()) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setTitle(session.title); setRenaming(false) }
        }}
        className="w-full text-[13px] px-2.5 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none"
      />
    )
  }

  return (
    <div className={`group flex items-center gap-0.5 rounded-md ${isActive ? 'bg-gray-200/80 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800/60'}`}>
      <Link href={`/${projectId}/pi/${session.id}`} className="flex-1 min-w-0 px-2.5 py-2">
        <div className={`text-[13px] truncate ${isActive ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>{session.title}</div>
        <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
          {showEmail ? `${session.user_email} · ` : ''}
          {relativeTime(session.updated_at)}
        </div>
      </Link>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Session options">
              <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRenaming(true)}><Pencil className="w-3.5 h-3.5 mr-2" />Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => remove.mutate()} className="text-red-600 focus:text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

const HISTORY_KEY = 'pi-history-collapsed'
const PAGE_SIZE = 50

export default function PiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const params = useParams()
  const projectId = params.projectid as string
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
    const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const isIndex = pathname === `/${projectId}/pi`
  const forceNew = searchParams.get('new') === '1'

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved !== null) setCollapsed(JSON.parse(saved))
      else if (window.innerWidth < 768) setCollapsed(true)
    } catch {}
  }, [])

  const openNewChat = () => router.push(`/${projectId}/pi?new=1`)

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch {}
  }

  const { data: sessions, isLoading } = useQuery<SessionRow[]>({
    queryKey: ['pi-sessions', projectId, 'mine'],
    queryFn: () => fetchJson(`/api/pi/sessions?projectId=${projectId}&scope=mine`),
    enabled: !!projectId,
  })

  const { data: mineSessions, isLoading: mineLoading } = useQuery<SessionRow[]>({
    queryKey: ['pi-sessions', projectId, 'mine'],
    queryFn: () => fetchJson(`/api/pi/sessions?projectId=${projectId}&scope=mine`),
    enabled: !!projectId && isIndex && !forceNew,
  })

  useEffect(() => {
    if (forceNew || !isIndex || !mineSessions?.length) return
    let last: string | null = null
    try { last = localStorage.getItem(`pi-last:${projectId}`) } catch {}
    const target = mineSessions.some((s) => s.id === last) ? last : mineSessions[0].id
    router.replace(`/${projectId}/pi/${target}`)
  }, [forceNew, isIndex, mineSessions, projectId, router])

  const resumePending = isIndex && !forceNew && (mineLoading || (mineSessions?.length ?? 0) > 0)

  const filtered = useMemo(() => {
    if (!sessions) return []
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter((s) => s.title.toLowerCase().includes(q) || s.user_email.toLowerCase().includes(q))
  }, [sessions, search])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [search])

  const visible = filtered.slice(0, visibleCount)

  return (
    <div className="h-full min-h-0 flex bg-gray-50 dark:bg-gray-950">
      {collapsed ? (
        <div className="w-11 shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-3 gap-2 bg-white dark:bg-gray-900">
          <button
            onClick={toggleCollapsed}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Show chat history"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <button
            onClick={openNewChat}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="w-[240px] sm:w-[260px] shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">Chats</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={openNewChat}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="New chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={toggleCollapsed}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Hide chat history"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-3 pb-2 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full text-[13px] pl-8 pr-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-gray-200 dark:focus:border-gray-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
            {isLoading && <PiLoading compact />}
            {!isLoading && filtered.length === 0 && (
              <div className="text-[12px] text-gray-400 px-2 py-6 text-center">No chats yet</div>
            )}
            {visible.map((s) => (
              <SessionRowItem
                key={s.id}
                session={s}
                isActive={pathname === `/${projectId}/pi/${s.id}`}
                projectId={projectId}
                showEmail={false}
                canManage
              />
            ))}
            {filtered.length > visible.length && (
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="w-full text-[12px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-2 text-center"
              >
                Show more
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {resumePending ? (
          <PiLoading />
        ) : children}
      </div>
    </div>
  )
}
