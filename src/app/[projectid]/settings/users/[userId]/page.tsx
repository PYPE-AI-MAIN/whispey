'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ArrowLeft, Crown, FlaskConical, User, ChevronDown, Save, Search, Copy } from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

type GlobalRole = 'superadmin' | 'prompter' | 'user'

interface AgentAccess {
  id: string
  name: string
  superadminOnlyColumns: string[]
  hiddenViewColumnsForUser: string[]
  hiddenDownloadColumnsForUser: string[]
}

interface ProjectAccess {
  id: string
  name: string
  downloadDisabled: boolean
  agents: AgentAccess[]
}

interface UserDetail {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  profile_image_url: string | null
  created_at: string
  globalRole: GlobalRole
}

const ROLE_META: Record<GlobalRole, { label: string; icon: React.ReactNode; pillClass: string }> = {
  superadmin: {
    label: 'Superadmin',
    icon: <Crown className="h-3 w-3" />,
    pillClass: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10 border-amber-300 dark:border-amber-400/20',
  },
  prompter: {
    label: 'Prompter',
    icon: <FlaskConical className="h-3 w-3" />,
    pillClass: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-400/10 border-violet-300 dark:border-violet-400/20',
  },
  user: {
    label: 'User',
    icon: <User className="h-3 w-3" />,
    pillClass: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700',
  },
}

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600', 'from-violet-500 to-purple-600', 'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600', 'from-pink-500 to-rose-600', 'from-cyan-500 to-sky-600',
]

function avatarColor(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

async function patchAgentOverride(agentId: string, userEmail: string, hiddenView: Set<string>, hiddenDownload: Set<string>) {
  return fetch(`/api/agents/${agentId}/download-settings/user-overrides`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: userEmail,
      hidden_view_columns: Array.from(hiddenView),
      hidden_download_columns: Array.from(hiddenDownload),
    }),
  })
}

function AgentColumnChecklist({
  agent, userEmail, otherAgentIds, onSaved,
}: {
  agent: AgentAccess
  userEmail: string
  otherAgentIds: string[]
  onSaved: () => void
}) {
  const [hiddenView, setHiddenView] = useState<Set<string>>(new Set(agent.hiddenViewColumnsForUser))
  const [hiddenDownload, setHiddenDownload] = useState<Set<string>>(new Set(agent.hiddenDownloadColumnsForUser))
  const [saving, setSaving] = useState(false)
  const [applyingAll, setApplyingAll] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Columns this admin page can even toggle: only the ones the agent has
  // marked superadmin-only — anything else is already visible to everyone.
  const toggleableColumns = agent.superadminOnlyColumns

  const toggleView = (col: string) => {
    setHiddenView(prev => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
    setDirty(true)
  }

  const toggleDownload = (col: string) => {
    setHiddenDownload(prev => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await patchAgentOverride(agent.id, userEmail, hiddenView, hiddenDownload)
      if (res.ok) {
        setDirty(false)
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleApplyToAll = async () => {
    setApplyingAll(true)
    try {
      await Promise.all(otherAgentIds.map(id => patchAgentOverride(id, userEmail, hiddenView, hiddenDownload)))
      onSaved()
    } finally {
      setApplyingAll(false)
    }
  }

  if (toggleableColumns.length === 0) {
    return (
      <p className="text-[11px] text-gray-500 dark:text-gray-400 px-4 py-3">
        This agent has no superadmin-only columns configured, so there is nothing to restrict for this user.
      </p>
    )
  }

  return (
    <div className="px-4 py-3 space-y-2 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">
        <span>Column</span>
        <div className="flex gap-6"><span className="w-16">Viewable</span><span className="w-16">Downloadable</span></div>
      </div>
      <div className="space-y-1">
        {toggleableColumns.map(col => (
          <div key={col} className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-300 px-1 py-0.5">
            <span className="truncate">{col}</span>
            <div className="flex gap-6 flex-shrink-0">
              <label className="flex items-center gap-1.5 cursor-pointer w-16">
                <Checkbox
                  checked={!hiddenView.has(col)}
                  onCheckedChange={() => toggleView(col)}
                />
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer w-16">
                <Checkbox
                  checked={!hiddenView.has(col) && !hiddenDownload.has(col)}
                  disabled={hiddenView.has(col)}
                  onCheckedChange={() => toggleDownload(col)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        {otherAgentIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleApplyToAll}
            disabled={applyingAll || saving}
            className="h-7 text-xs gap-1.5"
          >
            <Copy className="h-3 w-3" />
            {applyingAll ? 'Applying…' : 'Apply to all agents in project'}
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="h-7 text-xs gap-1.5">
          <Save className="h-3 w-3" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

function ProjectAgentsCard({
  project, userId, userEmail, onSaved,
}: {
  project: ProjectAccess
  userId: string
  userEmail: string
  onSaved: () => void
}) {
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null)
  const [downloadDisabled, setDownloadDisabled] = useState(project.downloadDisabled)
  const [savingToggle, setSavingToggle] = useState(false)

  useEffect(() => setDownloadDisabled(project.downloadDisabled), [project.downloadDisabled])

  const handleToggleDownload = async (allowDownload: boolean) => {
    const previous = downloadDisabled
    setSavingToggle(true)
    setDownloadDisabled(!allowDownload)
    try {
      const res = await fetch(`/api/admin/users/${userId}/agent-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id, download_disabled: !allowDownload }),
      })
      if (res.ok) {
        onSaved()
      } else {
        setDownloadDisabled(previous)
      }
    } catch {
      setDownloadDisabled(previous)
    } finally {
      setSavingToggle(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{project.name}</span>
        <label className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400">
          Allow downloads in this project
          <Switch
            checked={!downloadDisabled}
            disabled={savingToggle}
            onCheckedChange={(checked) => handleToggleDownload(checked)}
          />
        </label>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {project.agents.length === 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 px-4 py-3">No agents in this project.</p>
        )}
        {project.agents.map(agent => {
          const isExpanded = expandedAgentId === agent.id
          return (
            <div key={agent.id}>
              <button
                type="button"
                onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              >
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{agent.name}</span>
                <div className="flex items-center gap-2">
                  {agent.superadminOnlyColumns.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700">
                      {agent.superadminOnlyColumns.length} restricted column{agent.superadminOnlyColumns.length === 1 ? '' : 's'}
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {isExpanded && (
                <AgentColumnChecklist
                  agent={agent}
                  userEmail={userEmail}
                  otherAgentIds={project.agents.filter(a => a.id !== agent.id).map(a => a.id)}
                  onSaved={onSaved}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function UserDetailPage() {
  const { projectid: projectId, userId } = useParams<{ projectid: string; userId: string }>()
  const router = useRouter()
  const { isSuperAdmin, isLoading: roleLoading } = useGlobalRole()

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin) router.replace(`/${projectId}/settings/users`)
  }, [roleLoading, isSuperAdmin, projectId, router])

  const { data, isLoading, refetch } = useQuery<{ user: UserDetail; projects: ProjectAccess[] }>({
    queryKey: ['admin-user-agent-access', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/agent-access`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: isSuperAdmin && !!userId,
  })

  const [search, setSearch] = useState('')

  if (roleLoading || (isSuperAdmin && isLoading)) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
        <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent" />
      </div>
    )
  }

  if (!isSuperAdmin) return null

  const user = data?.user
  const projects = data?.projects ?? []

  const q = search.trim().toLowerCase()
  const filteredProjects = q
    ? projects.reduce<ProjectAccess[]>((acc, project) => {
        const projectMatches = project.name.toLowerCase().includes(q)
        const matchingAgents = project.agents.filter(agent => agent.name.toLowerCase().includes(q))
        if (projectMatches) acc.push(project)
        else if (matchingAgents.length > 0) acc.push({ ...project, agents: matchingAgents })
        return acc
      }, [])
    : projects

  const name = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0]
    : ''
  const initials = name.slice(0, 2).toUpperCase()
  const roleMeta = user ? ROLE_META[user.globalRole] ?? ROLE_META.user : ROLE_META.user
  const joined = user ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      {/* ── Header notch ── */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push(`/${projectId}/settings/users`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {user && (
            <>
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(user.email)} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{name}</h1>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${roleMeta.pillClass}`}>
                    {roleMeta.icon}{roleMeta.label}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user.email} · Joined {joined}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto pt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Call log column access
            </h2>
            {projects.length > 0 && (
              <div className="relative flex-shrink-0" style={{ width: '200px' }}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 dark:text-gray-400 pointer-events-none" />
                <input
                  placeholder="Search projects or agents…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-gray-800 transition-colors"
                />
              </div>
            )}
          </div>
          {projects.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 py-12 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              This user has no project access.
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 py-12 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              No projects or agents found{q ? ` for "${search}"` : ''}.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map(project => (
                <ProjectAgentsCard
                  key={project.id}
                  project={project}
                  userId={userId}
                  userEmail={user!.email}
                  onSaved={() => refetch()}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
