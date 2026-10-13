'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import {
  ArrowLeft, Search, Shield, Users, ChevronDown, Check,
  Crown, FlaskConical, User, ChevronLeft, ChevronRight,
  Trash2, Activity,
} from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { QaTeamAdmin } from '@/components/qa/QaTeamAdmin'
import { CreateMetricTemplateForm } from '@/components/CreateMetricTemplateForm'

type GlobalRole = 'superadmin' | 'prompter' | 'user'
type Tab = 'users' | 'metrics' | 'qa'

interface MetricTemplate {
  metric_id: string
  name: string
  description: string
  default_criteria: string
  default_scoring_mode: 'continuous' | 'binary'
  default_threshold: number
  category: string
  priority: string
  is_active: boolean
}

interface AdminUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  profile_image_url: string | null
  created_at: string
  clerk_id: string
  globalRole: GlobalRole
}

const PAGE_SIZE = 15

const SKELETON_ROW_KEYS = ['sk-0', 'sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6', 'sk-7', 'sk-8', 'sk-9']

const ROLES: { value: GlobalRole; label: string; icon: React.ReactNode; pillClass: string }[] = [
  {
    value: 'superadmin',
    label: 'Superadmin',
    icon: <Crown className="h-3 w-3" />,
    pillClass: 'text-warning bg-warning/15 border-warning/40',
  },
  {
    value: 'prompter',
    label: 'Prompter',
    icon: <FlaskConical className="h-3 w-3" />,
    pillClass: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-400/10 border-violet-300 dark:border-violet-400/20',
  },
  {
    value: 'user',
    label: 'User',
    icon: <User className="h-3 w-3" />,
    // Matches sidebar's inactive nav item feel
    pillClass: 'text-muted-foreground bg-muted border-border',
  },
]

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-sky-600',
]

function avatarColor(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function RolePill({ role }: { role: GlobalRole }) {
  // Falls back to the 'user' pill for any role value that isn't one of the
  // three known ones — protects against bad data slipping through (e.g. a
  // stale/legacy value in the DB) instead of crashing the whole users list.
  const r = ROLES.find(r => r.value === role) ?? ROLES.at(-1)!
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${r.pillClass}`}>
      {r.icon}{r.label}
    </span>
  )
}

type PageEntry = number | '…-left' | '…-right'

function pageNums(cur: number, total: number): PageEntry[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const out: PageEntry[] = [0]
  if (cur > 2) out.push('…-left')
  for (let i = Math.max(1, cur - 1); i <= Math.min(total - 2, cur + 1); i++) out.push(i)
  if (cur < total - 3) out.push('…-right')
  out.push(total - 1)
  return out
}

function MetricsTab() {
  const [templates, setTemplates] = useState<MetricTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch('/api/admin/metrics-templates')
      .then(r => r.json())
      .then(data => { setTemplates(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/metrics-templates/${confirmDeleteId}`, { method: 'DELETE' })
      if (res.ok) setTemplates(prev => prev.filter(t => t.metric_id !== confirmDeleteId))
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  let templatesSection: React.ReactNode
  if (loading) {
    templatesSection = (
      <div className="rounded-xl border border-border divide-y divide-border/60">
        {['s1', 's2', 's3', 's4'].map(key => (
          <div key={key} className="px-5 py-4 animate-pulse flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-2.5 w-20 bg-muted rounded" />
            </div>
            <div className="h-6 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    )
  } else if (templates.length === 0) {
    templatesSection = (
      <div className="rounded-xl border border-border py-16 flex flex-col items-center gap-2 text-muted-foreground">
        <Activity className="h-6 w-6" />
        <span className="text-sm">No metric templates yet</span>
      </div>
    )
  } else {
    templatesSection = (
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
        {templates.map(t => (
          <div key={t.metric_id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium text-foreground">{t.name}</span>
                {t.category && <Badge variant="outline" className="text-[11px] border-border text-muted-foreground">{t.category}</Badge>}
                {t.priority === 'critical' && <Badge variant="destructive" className="text-[11px]">Critical</Badge>}
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">{t.default_scoring_mode}</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{t.metric_id}</p>
              {t.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-lg">{t.description}</p>}
            </div>
            <button
              onClick={() => setConfirmDeleteId(t.metric_id)}
              className="ml-4 flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-8">
      <div className="max-w-6xl mx-auto pt-4 space-y-4">

        {/* the admin insert route always sets is_active: true on create */}
        <CreateMetricTemplateForm onCreated={(t) => setTemplates(prev => [...prev, { ...t, is_active: true }])} />

        {/* Templates list */}
        {templatesSection}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDeleteId} onOpenChange={open => { if (!open) setConfirmDeleteId(null) }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This template may be in use by agents. Deleting it will not affect current evaluations,
            but any user who opens and saves that agent&apos;s metrics will lose this metric permanently.
          </p>
          <p className="text-sm font-medium text-destructive">This cannot be undone.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-muted/50" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function UsersSettingsPage() {
  const { projectid: projectId } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isSuperAdmin, isLoading: roleLoading } = useGlobalRole()
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => { setPage(0) }, [search])

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin) router.replace(`/${projectId}/agents`)
  }, [roleLoading, isSuperAdmin, projectId, router])

  const { data, isLoading } = useQuery<{ users: AdminUser[] }>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: isSuperAdmin,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: async ({ userId, globalRole }: { userId: string; globalRole: GlobalRole }) => {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, globalRole }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  if (roleLoading) return (
    // Sidebar bg: bg-white dark:bg-gray-900
    <div className="flex items-center justify-center h-full bg-card">
      <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent" />
    </div>
  )

  if (!isSuperAdmin) return null

  const users = data?.users ?? []
  const q = search.trim().toLowerCase()
  const filtered = q
    ? users.filter(u => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').toLowerCase()
        return name.includes(q) || u.email.toLowerCase().includes(q)
      })
    : users

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(cur * PAGE_SIZE, (cur + 1) * PAGE_SIZE)

  const counts = {
    total: users.length,
    superadmin: users.filter(u => u.globalRole === 'superadmin').length,
    prompter: users.filter(u => u.globalRole === 'prompter').length,
  }

  let rows: React.ReactNode
  if (isLoading) {
    rows = SKELETON_ROW_KEYS.map(rowKey => (
      <tr key={rowKey} className="animate-pulse">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-2.5 w-28 bg-muted rounded" />
              <div className="h-2 w-36 bg-muted rounded" />
            </div>
          </div>
        </td>
        <td className="px-3 py-3"><div className="h-5 w-14 bg-muted rounded-full" /></td>
        <td className="px-3 py-3"><div className="h-2.5 w-12 bg-muted rounded" /></td>
        <td className="px-4 py-3"><div className="h-6 w-20 bg-muted rounded-lg ml-auto" /></td>
      </tr>
    ))
  } else if (filtered.length === 0) {
    rows = (
      <tr>
        <td colSpan={4} className="py-16 text-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Users className="h-6 w-6" />
            <span className="text-sm">No users found{q ? ` for "${search}"` : ''}</span>
          </div>
        </td>
      </tr>
    )
  } else {
    rows = paginated.map(u => {
      const nameParts = [u.first_name, u.last_name].filter(Boolean)
      const name = nameParts.length > 0 ? nameParts.join(' ') : u.email.split('@')[0]
      const initials = name.slice(0, 2).toUpperCase()
      const pending = mutation.isPending && (mutation.variables as any)?.userId === u.id
      const joined = new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

      return (
        <tr
          key={u.id}
          // Sidebar nav item hover: hover:bg-gray-50 dark:hover:bg-gray-800 — use same here
          className="transition-colors hover:bg-muted/50 cursor-pointer"
          onClick={() => router.push(`/${projectId}/settings/users/${u.id}`)}
        >
          {/* User */}
          <td className="px-4 py-3 overflow-hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(u.email)} flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0`}>
                {initials}
              </div>
              <div className="min-w-0">
                {/* Sidebar primary text: text-gray-900 dark:text-gray-100 */}
                <p className="text-[13px] font-medium text-foreground truncate leading-tight">{name}</p>
                {/* Sidebar secondary text: text-gray-500 dark:text-gray-400 */}
                <p className="text-[11px] text-muted-foreground truncate leading-tight">{u.email}</p>
              </div>
            </div>
          </td>

          {/* Role */}
          <td className="px-3 py-3 overflow-hidden">
            <RolePill role={u.globalRole} />
          </td>

          {/* Joined */}
          <td className="px-3 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
            {joined}
          </td>

          {/* Access */}
          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
            {u.globalRole === 'superadmin' ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Shield className="h-3 w-3" />Protected
              </span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={pending}
                    // Ghost style matching sidebar's nav items: no bg, hover:bg-gray-100 dark:hover:bg-gray-800
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {pending
                      ? <><span className="w-2.5 h-2.5 animate-spin rounded-full border border-border border-t-transparent" />Saving…</>
                      : <>Change role<ChevronDown className="h-2.5 w-2.5 ml-0.5 opacity-50" /></>
                    }
                  </button>
                </DropdownMenuTrigger>
                {/* Dropdown matches sidebar dropdown: bg-white dark:bg-gray-800, border-gray-200 dark:border-gray-700 */}
                <DropdownMenuContent
                  align="end"
                  className="w-40 rounded-xl border border-border bg-card shadow-xl p-1"
                >
                  {ROLES.map(r => (
                    <DropdownMenuItem
                      key={r.value}
                      onClick={() => r.value !== u.globalRole && mutation.mutate({ userId: u.id, globalRole: r.value })}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <span className={`flex items-center justify-center w-4 h-4 rounded-full border ${r.pillClass}`}>
                        {r.icon}
                      </span>
                      <span className="flex-1 font-medium">{r.label}</span>
                      {r.value === u.globalRole && <Check className="h-3 w-3 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </td>
        </tr>
      )
    })
  }

  return (
    /*
     * h-full works because SidebarWrapper's <main> is now overflow-hidden,
     * which clamps it to the remaining viewport height. This flex-col fills
     * that height exactly, and only the table div below scrolls.
     *
     * Background matches sidebar: bg-white dark:bg-gray-900 (the sidebar's own bg)
     * The main content area behind other pages is also gray-900 in dark mode.
     */
    <div className="h-full flex flex-col overflow-hidden bg-card">

      {/* ── Navbar — matches sidebar header border style ── */}
      <div className="flex-shrink-0 border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/${projectId}/agents`)}
              // Sidebar uses hover:bg-gray-100 dark:hover:bg-gray-800 for its nav items
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
            </div>
          </div>

        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex gap-1 pt-1">
          {(['users', 'metrics', 'qa'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium capitalize rounded-t-lg transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-400 bg-primary/10 dark:bg-blue-500/5'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {{ users: 'Users', metrics: 'Metrics', qa: 'QA team' }[tab]}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'metrics' && <MetricsTab />}
      {activeTab === 'qa' && <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6"><QaTeamAdmin /></div>}

      {/* ── Users tab content ── */}
      {activeTab === 'users' && <>
      <div className="flex-shrink-0 max-w-6xl w-full mx-auto px-4 sm:px-8 pt-4 pb-3 flex items-center justify-between gap-4">
        {/* Native input — avoids shadcn adding w-full */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0" style={{ width: '200px' }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-card transition-colors"
            />
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            {counts.total} total
          </span>
          {counts.superadmin > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/40">
              {counts.superadmin} superadmin
            </span>
          )}
          {counts.prompter > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-400/10 text-violet-600 dark:text-violet-400 border border-violet-300 dark:border-violet-400/20">
              {counts.prompter} prompter
            </span>
          )}
        </div>

        {!isLoading && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground mr-2 whitespace-nowrap">
              {cur * PAGE_SIZE + 1}–{Math.min((cur + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <PagBtn disabled={cur === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </PagBtn>
            {pageNums(cur, totalPages).map(p =>
              typeof p === 'string'
                ? <span key={p} className="w-7 h-7 flex items-center justify-center text-xs text-muted-foreground">…</span>
                : <PagBtn key={p} active={p === cur} onClick={() => setPage(p)}>{p + 1}</PagBtn>
            )}
            <PagBtn disabled={cur === totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </PagBtn>
          </div>
        )}
      </div>

      {/* ── Scrollable table area — this is the ONLY element that scrolls ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-8">
        <div className="max-w-6xl mx-auto rounded-xl border border-border overflow-hidden">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 'auto' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '130px' }} />
            </colgroup>
            <thead>
              {/* Header bg slightly darker than gray-900, matching sidebar group headers */}
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground">User</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground">Role</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground">Joined</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-muted-foreground">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows}
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </div>
  )
}

function PagBtn({ children, onClick, disabled, active }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? 'bg-blue-600 text-white'
          // Matches sidebar toggle button style
          : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}