'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import {
  ArrowLeft, Search, Shield, Users, ChevronDown, Check,
  Crown, FlaskConical, User, ChevronLeft, ChevronRight,
  Plus, Trash2, Activity,
} from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type GlobalRole = 'superadmin' | 'prompter' | 'user'
type Tab = 'users' | 'metrics'

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

const ROLES: { value: GlobalRole; label: string; icon: React.ReactNode; pillClass: string }[] = [
  {
    value: 'superadmin',
    label: 'Superadmin',
    icon: <Crown className="h-3 w-3" />,
    pillClass: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10 border-amber-300 dark:border-amber-400/20',
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
    pillClass: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700',
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
  const r = ROLES.find(r => r.value === role)!
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
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addForm, setAddForm] = useState({
    metric_id: '',
    name: '',
    description: '',
    default_criteria: '',
    default_scoring_mode: 'continuous' as 'continuous' | 'binary',
    default_threshold: 0.7,
    category: '',
    priority: 'medium',
  })

  const deriveMetricId = (name: string) =>
    name.toLowerCase().replaceAll(/\s+/g, '_').replaceAll(/[^a-z0-9_]/g, '').slice(0, 30)

  const handleNameChange = (name: string) => {
    const trimmed = name.slice(0, 30)
    setAddForm(f => ({ ...f, name: trimmed, metric_id: deriveMetricId(trimmed) }))
  }

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

  const handleAdd = async () => {
    setAddError('')
    if (!addForm.name || !addForm.default_criteria) {
      setAddError('Name and default criteria are required.')
      return
    }
    setAddLoading(true)
    try {
      const res = await fetch('/api/admin/metrics-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (res.ok) {
        setTemplates(prev => [...prev, data])
        setAddForm({ metric_id: '', name: '', description: '', default_criteria: '', default_scoring_mode: 'continuous', default_threshold: 0.7, category: '', priority: 'medium' })
        setAddFormOpen(false)
      } else {
        setAddError(data.error ?? 'Failed to create template.')
      }
    } finally {
      setAddLoading(false)
    }
  }

  let templatesSection: React.ReactNode
  if (loading) {
    templatesSection = (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {['s1', 's2', 's3', 's4'].map(key => (
          <div key={key} className="px-5 py-4 animate-pulse flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-2.5 w-20 bg-gray-200 dark:bg-gray-800/60 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    )
  } else if (templates.length === 0) {
    templatesSection = (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 py-16 flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
        <Activity className="h-6 w-6" />
        <span className="text-sm">No metric templates yet</span>
      </div>
    )
  } else {
    templatesSection = (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
        {templates.map(t => (
          <div key={t.metric_id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
                {t.category && <Badge variant="outline" className="text-[10px] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">{t.category}</Badge>}
                {t.priority === 'critical' && <Badge variant="destructive" className="text-[10px]">Critical</Badge>}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700">{t.default_scoring_mode}</span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 font-mono mt-0.5">{t.metric_id}</p>
              {t.description && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-lg">{t.description}</p>}
            </div>
            <button
              onClick={() => setConfirmDeleteId(t.metric_id)}
              className="ml-4 flex-shrink-0 p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6">
      <div className="max-w-5xl mx-auto pt-4 space-y-4">

        {/* Add New Template */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setAddFormOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Add New Template
            </span>
            <span className="text-gray-600 dark:text-gray-400 text-xs">{addFormOpen ? 'Cancel' : 'Expand'}</span>
          </button>

          {addFormOpen && (
            <div className="px-5 pb-5 pt-1 border-t border-gray-200 dark:border-gray-800 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
              {addError && <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Name *</Label>
                  <span className="text-[10px] text-gray-600 dark:text-gray-400">{addForm.name.length}/30</span>
                </div>
                <Input
                  className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="e.g. Call Quality"
                  maxLength={30}
                  value={addForm.name}
                  onChange={e => handleNameChange(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Description</Label>
                <Input className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" placeholder="Short description" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Default Criteria *</Label>
                <Textarea className="mt-1 text-xs min-h-[80px] font-mono resize-none bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" placeholder="Evaluation criteria prompt..." value={addForm.default_criteria} onChange={e => setAddForm(f => ({ ...f, default_criteria: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Scoring Mode *</Label>
                  <Select value={addForm.default_scoring_mode} onValueChange={(v: 'continuous' | 'binary') => setAddForm(f => ({ ...f, default_scoring_mode: v }))}>
                    <SelectTrigger className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continuous">Continuous (0–1)</SelectItem>
                      <SelectItem value="binary">Binary (0 or 1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Default Threshold</Label>
                  <Input type="number" step="0.01" min="0" max="1" className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" value={addForm.default_threshold} onChange={e => setAddForm(f => ({ ...f, default_threshold: Number.parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Category</Label>
                  <Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="effectiveness">Effectiveness</SelectItem>
                      <SelectItem value="efficiency">Efficiency</SelectItem>
                      <SelectItem value="reliability">Reliability</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="experience">Experience</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Priority</Label>
                  <Select value={addForm.priority} onValueChange={v => setAddForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={handleAdd} disabled={addLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {addLoading ? 'Creating...' : 'Create Template'}
              </Button>
            </div>
          )}
        </div>

        {/* Templates list */}
        {templatesSection}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDeleteId} onOpenChange={open => { if (!open) setConfirmDeleteId(null) }}>
        <DialogContent className="max-w-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This template may be in use by agents. Deleting it will not affect current evaluations,
            but any user who opens and saves that agent&apos;s metrics will lose this metric permanently.
          </p>
          <p className="text-sm font-medium text-red-600 dark:text-red-400">This cannot be undone.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Cancel</Button>
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
    <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
      <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent" />
    </div>
  )

  if (!isSuperAdmin) { router.replace(`/${projectId}/agents`); return null }

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
    rows = Array.from({ length: 10 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 flex-shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-2.5 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-2 w-36 bg-gray-200 dark:bg-gray-800/60 rounded" />
            </div>
          </div>
        </td>
        <td className="px-3 py-3"><div className="h-5 w-14 bg-gray-200 dark:bg-gray-800 rounded-full" /></td>
        <td className="px-3 py-3"><div className="h-2.5 w-12 bg-gray-200 dark:bg-gray-800 rounded" /></td>
        <td className="px-4 py-3"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-800 rounded-lg ml-auto" /></td>
      </tr>
    ))
  } else if (filtered.length === 0) {
    rows = (
      <tr>
        <td colSpan={4} className="py-16 text-center">
          <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
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
          className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {/* User */}
          <td className="px-4 py-3 overflow-hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(u.email)} flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0`}>
                {initials}
              </div>
              <div className="min-w-0">
                {/* Sidebar primary text: text-gray-900 dark:text-gray-100 */}
                <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate leading-tight">{name}</p>
                {/* Sidebar secondary text: text-gray-500 dark:text-gray-400 */}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight">{u.email}</p>
              </div>
            </div>
          </td>

          {/* Role */}
          <td className="px-3 py-3 overflow-hidden">
            <RolePill role={u.globalRole} />
          </td>

          {/* Joined */}
          <td className="px-3 py-3 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {joined}
          </td>

          {/* Access */}
          <td className="px-4 py-3 text-right">
            {u.globalRole === 'superadmin' ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
                <Shield className="h-3 w-3" />Protected
              </span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={pending}
                    // Ghost style matching sidebar's nav items: no bg, hover:bg-gray-100 dark:hover:bg-gray-800
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {pending
                      ? <><span className="w-2.5 h-2.5 animate-spin rounded-full border border-gray-400 dark:border-gray-500 border-t-transparent" />Saving…</>
                      : <>Change role<ChevronDown className="h-2.5 w-2.5 ml-0.5 opacity-50" /></>
                    }
                  </button>
                </DropdownMenuTrigger>
                {/* Dropdown matches sidebar dropdown: bg-white dark:bg-gray-800, border-gray-200 dark:border-gray-700 */}
                <DropdownMenuContent
                  align="end"
                  className="w-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-1"
                >
                  {ROLES.map(r => (
                    <DropdownMenuItem
                      key={r.value}
                      onClick={() => r.value !== u.globalRole && mutation.mutate({ userId: u.id, globalRole: r.value })}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700"
                    >
                      <span className={`flex items-center justify-center w-4 h-4 rounded-full border ${r.pillClass}`}>
                        {r.icon}
                      </span>
                      <span className="flex-1 font-medium">{r.label}</span>
                      {r.value === u.globalRole && <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />}
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
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-gray-900">

      {/* ── Navbar — matches sidebar header border style ── */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/${projectId}/agents`)}
              // Sidebar uses hover:bg-gray-100 dark:hover:bg-gray-800 for its nav items
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Whispey Admin Dashboard</h1>
            </div>
          </div>

        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 flex gap-1 pt-1">
          {(['users', 'metrics'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium capitalize rounded-t-lg transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/5'
                  : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {tab === 'users' ? 'Users' : 'Metrics'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'metrics' && <MetricsTab />}

      {/* ── Users tab content ── */}
      {activeTab === 'users' && <>
      <div className="flex-shrink-0 max-w-5xl w-full mx-auto px-6 pt-4 pb-3 flex items-center justify-between gap-4">
        {/* Native input — avoids shadcn adding w-full */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0" style={{ width: '200px' }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 dark:text-gray-400 pointer-events-none" />
            <input
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-gray-800 transition-colors"
            />
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700">
            {counts.total} total
          </span>
          {counts.superadmin > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-400/20">
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
            <span className="text-[11px] text-gray-600 dark:text-gray-400 mr-2 whitespace-nowrap">
              {cur * PAGE_SIZE + 1}–{Math.min((cur + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <PagBtn disabled={cur === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </PagBtn>
            {pageNums(cur, totalPages).map(p =>
              typeof p === 'string'
                ? <span key={p} className="w-7 h-7 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400">…</span>
                : <PagBtn key={p} active={p === cur} onClick={() => setPage(p)}>{p + 1}</PagBtn>
            )}
            <PagBtn disabled={cur === totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </PagBtn>
          </div>
        )}
      </div>

      {/* ── Scrollable table area — this is the ONLY element that scrolls ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 'auto' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '130px' }} />
            </colgroup>
            <thead>
              {/* Header bg slightly darker than gray-900, matching sidebar group headers */}
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Role</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Joined</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
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
          : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  )
}