// src/app/admin/projects/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, Building2, Users, Bot, Save, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import toast from 'react-hot-toast'

interface Project {
  id: string
  name: string
  agent: {
    usage: {
      active_count: number
    }
    limits: {
      max_agents: number
    }
  } | null
  plans: {
    type: 'FREE' | 'BETA' | 'PAID'
    level: number
  }
  created_at: string
  member_count: number
  owner_email: string
}

export default function AdminProjectsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user: clerkUser, isLoaded } = useUser()
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  
  // Track edited projects
  const [editedProjects, setEditedProjects] = useState<Record<string, { plan?: string; maxAgents?: number }>>({})

  // Check if user is SUPERADMIN
  useEffect(() => {
    const checkAccess = async () => {
      if (!isLoaded) return
      
      if (!clerkUser?.id) {
        router.push('/unauthorized')
        return
      }

      try {
        // ✅ Use new check-access endpoint
        const response = await fetch('/api/user/check-access')
        
        if (!response.ok) {
          setIsAuthorized(false)
          router.push('/unauthorized')
          return
        }
        
        const result = await response.json()
        
        if (result.isSuperAdmin) {
          setIsAuthorized(true)
        } else {
          setIsAuthorized(false)
          router.push('/unauthorized')
        }
      } catch (error) {
        console.error('Error checking access:', error)
        setIsAuthorized(false)
        router.push('/unauthorized')
      }
    }

    checkAccess()
  }, [clerkUser, isLoaded, router])

  // Fetch projects
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'projects', search, planFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (planFilter !== 'all') params.append('plan', planFilter)

      const response = await fetch(`/api/admin/projects?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch projects')
      return response.json()
    },
    enabled: isAuthorized === true,
    staleTime: 30000,
    retry: false
  })

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async ({ projectId, plan, maxAgents }: { projectId: string; plan?: string; maxAgents?: number }) => {
      const response = await fetch('/api/admin/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          new_plan: plan,
          max_agents: maxAgents
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update project')
      }
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'projects'] })
      toast.success('Project updated successfully')
      // Remove from edited projects
      setEditedProjects(prev => {
        const newState = { ...prev }
        delete newState[variables.projectId]
        return newState
      })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const handlePlanChange = (projectId: string, newPlan: string) => {
    setEditedProjects(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        plan: newPlan
      }
    }))
  }

  const handleMaxAgentsChange = (projectId: string, maxAgents: number) => {
    setEditedProjects(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        maxAgents
      }
    }))
  }

  const handleSaveChanges = (projectId: string, project: Project) => {
    const edits = editedProjects[projectId]
    if (!edits) return

    const currentMaxAgents = project.agent?.limits?.max_agents ?? 0

    updateProjectMutation.mutate({
      projectId,
      plan: edits.plan !== project.plans.type ? edits.plan : undefined,
      maxAgents: edits.maxAgents !== currentMaxAgents ? edits.maxAgents : undefined
    })
  }

  const hasChanges = (projectId: string, project: Project) => {
    const edits = editedProjects[projectId]
    if (!edits) return false
    
    const currentMaxAgents = project.agent?.limits?.max_agents ?? 0
    
    return (edits.plan && edits.plan !== project.plans.type) ||
           (edits.maxAgents !== undefined && edits.maxAgents !== currentMaxAgents)
  }

  // Group projects by plan
  const projectsByPlan = data?.projects?.reduce((acc: Record<string, Project[]>, project: Project) => {
    const plan = project.plans.type
    if (!acc[plan]) acc[plan] = []
    acc[plan].push(project)
    return acc
  }, {}) || {}

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'PAID': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      case 'BETA': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

  const maxAgentsOptions = [0, 2, 5, 10, 20, 50, 100, 200]

  if (isAuthorized === null || !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (isAuthorized === false) {
    return null
  }

  return (
    <div className="p-6 max-w-7xl mx-auto dark:bg-gray-900">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Project Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage project plans, agent limits, and member permissions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by project name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="FREE">FREE</SelectItem>
            <SelectItem value="BETA">BETA</SelectItem>
            <SelectItem value="PAID">PAID</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          Error loading projects. Please try again.
        </div>
      )}

      {/* Projects List */}
      {!isLoading && !error && (
        <div className="space-y-6">
          {['PAID', 'BETA', 'FREE'].map((plan) => {
            const projects = projectsByPlan[plan] || []
            if (projects.length === 0) return null

            return (
              <section key={plan}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {plan} PLAN
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({projects.length})
                  </span>
                </div>

                <div className="space-y-3">
                  {projects.map((project: any) => {
                    const currentPlan = editedProjects[project.id]?.plan || project.plans.type
                    const currentMaxAgents = editedProjects[project.id]?.maxAgents ?? (project.agent?.limits?.max_agents ?? 0)
                    const activeAgents = project.agent?.usage?.active_count ?? 0
                    const hasEdits = hasChanges(project.id, project)

                    return (
                      <article
                        key={project.id}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                      >
                        <div className="space-y-4">
                          {/* Project Info */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {project.name}
                                  </h3>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${getPlanBadgeColor(plan)}`}>
                                    {plan}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                  <div className="flex items-center gap-1">
                                    <Bot className="w-4 h-4" />
                                    <span>{activeAgents}/{currentMaxAgents} agents</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    <span>{project.member_count} member{project.member_count !== 1 ? 's' : ''}</span>
                                  </div>
                                </div>

                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  Owner: {project.owner_email}
                                </p>
                              </div>
                            </div>

                            {/* ✅ NEW: View Members Button */}
                            <Button
                              onClick={() => router.push(`/admin/projects/${project.id}`)}
                              variant="outline"
                              size="sm"
                              className="flex-shrink-0 ml-3"
                            >
                              <Users className="w-4 h-4 mr-2" />
                              View Members
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </div>

                          {/* Controls */}
                          <div className="flex items-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                            <div className="flex-1">
                              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                                Plan Type
                              </label>
                              <Select 
                                value={currentPlan} 
                                onValueChange={(value) => handlePlanChange(project.id, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="FREE">FREE</SelectItem>
                                  <SelectItem value="BETA">BETA</SelectItem>
                                  <SelectItem value="PAID">PAID</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex-1">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                                    Max Agents
                                </label>
                                <div className="flex gap-1">
                                    {/* Quick buttons for common values */}
                                    <div className="flex gap-1">
                                    {[0, 2, 5, 10].map(value => (
                                        <button
                                        key={value}
                                        onClick={() => handleMaxAgentsChange(project.id, value)}
                                        className={`px-2 py-1 text-xs rounded border ${
                                            currentMaxAgents === value
                                            ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                        >
                                        {value}
                                        </button>
                                    ))}
                                    </div>
                                    
                                    {/* Custom input */}
                                    <input
                                    type="number"
                                    min="0"
                                    max="1000"
                                    value={currentMaxAgents}
                                    onChange={(e) => handleMaxAgentsChange(project.id, parseInt(e.target.value) || 0)}
                                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                </div>

                            <Button
                              onClick={() => handleSaveChanges(project.id, project)}
                              disabled={!hasEdits || updateProjectMutation.isPending}
                              className={`${
                                hasEdits 
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {updateProjectMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  Save
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {/* No results */}
          {Object.keys(projectsByPlan).length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No projects found matching your criteria
            </div>
          )}
        </div>
      )}
    </div>
  )
}