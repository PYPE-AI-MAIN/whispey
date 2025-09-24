'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import TokenRegenerationConfirmDialog from '../TokenRegenerationConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ChevronRight, Settings, Loader2, AlertCircle, Search, Plus, MoreHorizontal, Trash2, Key, Copy, Eye, EyeOff, RefreshCw, Users, Clock, Grid3X3, List, Building2, ChevronsUpDown } from 'lucide-react'
import ProjectCreationDialog from './ProjectCreationDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import MemberManagementDialog from '../MemberManagmentDialog'
import { useMobile } from '@/hooks/use-mobile'

interface Project {
  id: string
  name: string
  description: string
  environment: string
  created_at: string
  is_active: boolean
  token_hash?: string
  agent_count?: number
}

interface ProjectSelectionProps {
  isAuthLoaded?: boolean
}

const ProjectSelection: React.FC<ProjectSelectionProps> = ({ isAuthLoaded = false}) => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deletingProject, setDeletingProject] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Project | null>(null)
  const [showTokenDialog, setShowTokenDialog] = useState<Project | null>(null)
  const [regeneratedToken, setRegeneratedToken] = useState<string | null>(null)
  const [regeneratingToken, setRegeneratingToken] = useState<string | null>(null)
  const [membersDialog, setShowAddMemberDialog] = useState<boolean>(false)
  const [showToken, setShowToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [projectSelected, setSelectedProjectForDialog] = useState<any>(null)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { isMobile } = useMobile(768)
  
  // Initialize viewMode from localStorage
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('workspace-view-mode') as 'grid' | 'list') || 'grid'
    }
    return 'grid'
  })
  
  // Initialize density from localStorage
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('workspace-card-density') as 'comfortable' | 'compact') || 'comfortable'
    }
    return 'comfortable'
  })
  
  const router = useRouter()

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('workspace-view-mode', viewMode)
      localStorage.setItem('workspace-card-density', density)
    }
  }, [viewMode, density])

  const fetchProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [isAuthLoaded])

  const refetch = fetchProjects;

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project.id)
    setTimeout(() => {
      router.push(`/${project.id}/agents`)
    }, 150)
  }

  const handleCreateProject = () => {
    setShowCreateDialog(true)
  }

  const handleProjectCreated = (newProject: Project) => {
    refetch()
    setTimeout(() => {
      router.push(`/${newProject.id}/agents`)
    }, 500)
  }

  const handleDeleteProject = async (project: Project) => {
    setDeletingProject(project.id)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete workspace')
      }

      const result = await response.json()
      refetch()
      setShowDeleteConfirm(null)
    } catch (error: unknown) {
      console.error('Error deleting workspace:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete workspace'
      alert(`Failed to delete workspace: ${errorMessage}`)
    } finally {
      setDeletingProject(null)
    }
  }

  const handleRegenerateToken = async (project: Project) => {
    setRegeneratingToken(project.id)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_token' }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to regenerate token')
      }
      const result = await response.json()
      setRegeneratedToken(result.api_token)
      setShowTokenDialog(project)
      setShowRegenerateConfirm(null)
      refetch()
    } catch (error: unknown) {
      console.error('Error regenerating token:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate token'
      alert(`Failed to regenerate token: ${errorMessage}`)
    } finally {
      setRegeneratingToken(null)
    }
  }

  const handleCopyToken = async () => {
    if (regeneratedToken) {
      try {
        await navigator.clipboard.writeText(regeneratedToken)
        setTokenCopied(true)
        setTimeout(() => setTokenCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy token:', err)
      }
    }
  }

  const handleCloseTokenDialog = () => {
    setShowTokenDialog(null)
    setRegeneratedToken(null)
    setShowToken(false)
    setTokenCopied(false)
  }

  const getWorkspaceInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
  }

  const getEnvironmentColor = (environment: string) => {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
      case 'development':
      case 'dev':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const filteredProjects = projects?.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || []

  // Comfortable Card Component (Original Style)
  const ComfortableCard = ({ project }: { project: Project }) => (
    <Card
      className={`group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer ${
        selectedProject === project.id ? 'opacity-50 scale-[0.98]' : ''
      }`}
      onClick={() => handleProjectClick(project)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
              {getWorkspaceInitials(project.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{project.name}</h3>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${project.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
              </div>
              <div className="flex items-center gap-1">
                <Badge 
                  variant="outline" 
                  className={`text-xs font-normal border ${getEnvironmentColor(project.environment)} px-1.5 py-0`}
                >
                  {project.environment}
                </Badge>
                {project.token_hash && (
                  <Badge variant="outline" className="text-xs font-normal bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 px-1.5 py-0">
                    <Key className="h-2 w-2 mr-0.5" />
                    API
                  </Badge>
                )}
                {project.agent_count !== undefined && (
                  <Badge variant="outline" className="text-xs font-normal bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 px-1.5 py-0">
                    {project.agent_count}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                setSelectedProjectForDialog(project)
                setShowAddMemberDialog(true)
              }} className="text-xs">
                <Users className="h-3 w-3 mr-2" />
                Manage access
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                router.push(`${project.id}/agents/api-keys`)
              }} className="text-xs">
                <Settings className="h-3 w-3 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                router.push(`/${project.id}/agents/api-keys`)
              }} disabled={regeneratingToken === project.id} className="text-xs">
                {regeneratingToken === project.id ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-2" />
                )}
                Regenerate token
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                setShowDeleteConfirm(project)
              }} className="text-xs text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400">
                <Trash2 className="h-3 w-3 mr-2" />
                Delete workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{formatDate(project.created_at)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            <span>Open</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Compact Card Component (New Compact Style)
  const CompactCard = ({ project }: { project: Project }) => (
    <Card
      className={`group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer ${
        selectedProject === project.id ? 'opacity-50 scale-[0.98]' : ''
      }`}
      onClick={() => handleProjectClick(project)}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-blue-600 rounded flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
              {getWorkspaceInitials(project.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{project.name}</h3>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${project.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-xs font-normal border ${getEnvironmentColor(project.environment)} px-1.5 py-0 h-4`}>
                  {project.environment}
                </Badge>
                {project.token_hash && (
                  <Badge variant="outline" className="text-xs font-normal bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 px-1.5 py-0 h-4">
                    <Key className="h-2 w-2 mr-0.5" />
                    API
                  </Badge>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">{project.agent_count} agents</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(project.created_at)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  setSelectedProjectForDialog(project)
                  setShowAddMemberDialog(true)
                }} className="text-xs">
                  <Users className="h-3 w-3 mr-2" />
                  Manage access
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/${project.id}/agents/api-keys`)
                }} className="text-xs">
                  <Settings className="h-3 w-3 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/${project.id}/agents/api-keys`)
                }} disabled={regeneratingToken === project.id} className="text-xs">
                  {regeneratingToken === project.id ? (
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-2" />
                  )}
                  Regenerate token
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  setShowDeleteConfirm(project)
                }} className="text-xs text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400">
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const CurrentCardComponent = density === 'compact' ? CompactCard : ComfortableCard

  if (loading || !isAuthLoaded) {
    return (
      <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
        <div className="max-w-7xl mx-auto px-6 py-6 w-full flex-shrink-0">
          {/* Header Skeleton */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="h-3 w-80 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>

            {/* Controls Skeleton */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Scrollable Skeleton Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-100 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
          <div className="max-w-7xl mx-auto px-6 pb-6">
            {/* Workspace Grid Skeleton */}
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    {/* Header Skeleton */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-shrink-0"></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                            <div className="w-1.5 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                            <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                      <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>

                    {/* Description Skeleton */}
                    <div className="space-y-1 mb-4">
                      <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>

                    {/* Footer Skeleton */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Failed to load workspaces</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{error}</p>
            </div>
            <Button 
              onClick={() => window.location.reload()} 
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 h-7"
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
      <div className="max-w-7xl mx-auto px-6 py-6 w-full">
        {/* Fixed Header */}
        <div className="mb-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Workspaces</h1>
                <Badge variant="outline" className="text-xs text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                  {projects.length}
                </Badge>
              </div>
             {!isMobile && <p className="text-xs text-gray-600 dark:text-gray-400">
                Organize agents by team. Each workspace provides isolated access and analytics.
              </p>}
            </div>
            <Button 
              onClick={handleCreateProject}
              size="sm"
              className={`bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-8 ${isMobile ? 'px-3 py-0' : 'px-3 py-1.5'}`}
            >
              <Plus className={`w-3 h-3 ${isMobile ? '' : 'mr-1.5'}`} />
              {isMobile ? '' : 'New Workspace'}
            </Button>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="search"
                  placeholder="Search workspaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${isMobile ? 'w-full' : 'w-64'} pl-7 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-all focus:bg-white dark:focus:bg-gray-700`}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Density Control - Single toggle */}
              {viewMode === 'grid' && <button
                onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
                title={`Switch to ${density === 'comfortable' ? 'compact' : 'comfortable'} view`}
                className="flex items-center justify-center w-7 h-7 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronsUpDown className="w-3 h-3" />
              </button>}

              {/* View Mode Control */}
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded p-0.5 bg-gray-50 dark:bg-gray-800">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`w-6 h-6 p-0 text-xs ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100 hover:bg-white dark:hover:bg-gray-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-transparent'}`}
                >
                  <Grid3X3 className="w-3 h-3" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`w-6 h-6 p-0 text-xs ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100 hover:bg-white dark:hover:bg-gray-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-transparent'}`}
                >
                  <List className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-100 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
        <div className="max-w-7xl mx-auto px-6 pb-6">
          {/* Content Grid/Table */}
          {viewMode === 'list' ? (
            // Table View
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              {/* Table Header */}
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  <div className="col-span-6">Workspace Name</div>
                  <div className="col-span-2">Environment</div>
                  <div className="col-span-2">Created</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
              </div>
              
              {/* Table Body */}
              <div>
                {filteredProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className={`group px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                      index !== filteredProjects.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                    } ${selectedProject === project.id ? 'opacity-50' : ''}`}
                    onClick={() => handleProjectClick(project)}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Workspace */}
                      <div className="col-span-6 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                          {getWorkspaceInitials(project.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{project.name}</h3>
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${project.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                            {project.token_hash && (
                              <Badge variant="outline" className="text-xs font-normal bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 px-1.5 py-0 h-4">
                                <Key className="h-2 w-2 mr-0.5" />
                                API
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Environment */}
                      <div className="col-span-2">
                        <Badge variant="outline" className={`text-xs font-normal border ${getEnvironmentColor(project.environment)} px-2 py-1`}>
                          {project.environment}
                        </Badge>
                      </div>
                      
                      
                      {/* Created */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(project.created_at)}</span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              setSelectedProjectForDialog(project)
                              setShowAddMemberDialog(true)
                            }} className="text-xs">
                              <Users className="h-3 w-3 mr-2" />
                              Manage access
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/${project.id}/agents/api-keys`)
                            }} className="text-xs">
                              <Settings className="h-3 w-3 mr-2" />
                              Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/${project.id}/agents/api-keys`)
                            }} disabled={regeneratingToken === project.id} className="text-xs">
                              {regeneratingToken === project.id ? (
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3 mr-2" />
                              )}
                              Regenerate token
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              setShowDeleteConfirm(project)
                            }} className="text-xs text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400">
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete workspace
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Grid View 
            <div className={`grid gap-3 ${
              density === 'compact' 
                ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' 
                : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
            }`}>
              {filteredProjects.map((project) => (
                <CurrentCardComponent key={project.id} project={project} />
              ))}
            </div>
          )}

          {/* Empty States */}
          {filteredProjects.length === 0 && searchQuery && (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No workspaces found</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                No workspaces match "<span className="font-medium text-gray-900 dark:text-gray-100">{searchQuery}</span>". 
                Try different search terms.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 text-xs h-7 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Clear search
              </Button>
            </div>
          )}

          {projects.length === 0 && !loading && !error && (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Create your first workspace</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 max-w-lg mx-auto">
                Organize agents by team. Each workspace provides isolated access control and analytics.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={handleCreateProject}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Create workspace
                </Button>
                <div className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  <p><strong>Example:</strong> "Sales Team" to organize sales voice agents with team access.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All Dialogs */}
      <ProjectCreationDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onProjectCreated={handleProjectCreated}
      />

      <Dialog open={showTokenDialog !== null} onOpenChange={handleCloseTokenDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">API token generated</DialogTitle>
            <DialogDescription className="text-xs text-gray-600 dark:text-gray-400">
              A new API token has been generated for "{showTokenDialog?.name}". Save this securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-900 dark:text-gray-100 mb-1">API Token</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={regeneratedToken || ''}
                  readOnly
                  className="w-full h-8 px-2 pr-16 text-xs border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono focus:outline-none"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowToken(!showToken)}
                    className="h-5 w-5 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyToken}
                    className="h-5 w-5 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {tokenCopied && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Token copied to clipboard</p>
              )}
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> Store this token securely. The previous token has been invalidated.
              </p>
            </div>
            <div className="flex justify-end pt-3">
              <Button onClick={handleCloseTokenDialog} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete workspace</DialogTitle>
            <DialogDescription className="text-xs text-gray-600 dark:text-gray-400">
              Delete "{showDeleteConfirm?.name}"? This permanently removes all agents, logs, and analytics.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(null)} className="flex-1 text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => showDeleteConfirm && handleDeleteProject(showDeleteConfirm)}
              disabled={deletingProject !== null}
              className="flex-1 text-xs"
            >
              {deletingProject ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TokenRegenerationConfirmDialog
        isOpen={showRegenerateConfirm !== null}
        project={showRegenerateConfirm}
        isRegenerating={regeneratingToken === showRegenerateConfirm?.id}
        onConfirm={() => showRegenerateConfirm && handleRegenerateToken(showRegenerateConfirm)}
        onCancel={() => setShowRegenerateConfirm(null)}
      />

      <MemberManagementDialog
        isOpen={membersDialog}
        onClose={setShowAddMemberDialog}
        project={projectSelected}
      />
    </div>
  )
}

export default ProjectSelection