'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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

const getOrganisationInitials = (name: string) => {
  return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
}

const getEnvironmentColor = (environment: string) => {
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return 'bg-destructive/10 text-destructive border-destructive/30'
    case 'development':
    case 'dev':
      return 'bg-primary/10 text-primary border-primary/30'
    default:
      return 'bg-muted/50 text-foreground border-border'
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


const filterProjects = (projects: Project[] | undefined, query: string): Project[] => {
  const q = query.toLowerCase()
  return (projects ?? []).filter((project) => `${project.name} ${project.description ?? ''}`.toLowerCase().includes(q))
}

const errorText = (error: unknown, fallback: string): string => (error instanceof Error ? error.message : fallback)

function TokenDialog({
  project, token, visible, copied, onToggleVisible, onCopy, onClose,
}: Readonly<{
  project: Project | null
  token: string | null
  visible: boolean
  copied: boolean
  onToggleVisible: () => void
  onCopy: () => void
  onClose: () => void
}>) {
  return (
  <Dialog open={project !== null} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle className="text-base font-semibold">API token generated</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          A new API token has been generated for "{project?.name}". Save this securely.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label htmlFor="api-token" className="block text-xs font-medium text-foreground mb-1">API Token</label>
          <div className="relative">
            <input
              id="api-token"
              type={visible ? 'text' : 'password'}
              value={token ?? ''}
              readOnly
              className="w-full h-8 px-2 pr-16 text-xs border border-border rounded bg-muted/50 text-foreground font-mono focus:outline-none"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onToggleVisible}
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              >
                {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onCopy}
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
          {copied && (
            <p className="text-xs text-success mt-1">Token copied to clipboard</p>
          )}
        </div>
        <div className="p-3 bg-warning/10 border border-warning/30 rounded">
          <p className="text-xs text-warning">
            <strong>Important:</strong> Store this token securely. The previous token has been invalidated.
          </p>
        </div>
        <div className="flex justify-end pt-3">
          <Button onClick={onClose} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
            Done
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
  )
}

function ViewControls({
  viewMode, onViewMode, density, onDensity,
}: Readonly<{
  viewMode: 'grid' | 'list'
  onViewMode: (mode: 'grid' | 'list') => void
  density: 'comfortable' | 'compact'
  onDensity: (density: 'comfortable' | 'compact') => void
}>) {
  const otherDensity = density === 'comfortable' ? 'compact' : 'comfortable'
  return (
      <div className="flex items-center gap-3">
        {/* Density Control - Single toggle */}
        {viewMode === 'grid' && <button
          onClick={() => onDensity(otherDensity)}
          title={`Switch to ${otherDensity} view`}
          className="flex items-center justify-center w-7 h-7 border border-border rounded bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronsUpDown className="w-3 h-3" />
        </button>}

        {/* View Mode Control */}
        <div className="flex items-center border border-border rounded p-0.5 bg-muted/50">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewMode('grid')}
            className={`w-6 h-6 p-0 text-xs ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-foreground hover:bg-card dark:hover:bg-gray-700' : 'text-gray-500 hover:text-foreground hover:bg-transparent'}`}
          >
            <Grid3X3 className="w-3 h-3" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewMode('list')}
            className={`w-6 h-6 p-0 text-xs ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-foreground hover:bg-card dark:hover:bg-gray-700' : 'text-gray-500 hover:text-foreground hover:bg-transparent'}`}
          >
            <List className="w-3 h-3" />
          </Button>
        </div>
      </div>
  )
}

async function apiJson(url: string, init: RequestInit, failure: string) {
  const response = await fetch(url, init)
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || failure)
  }
  return response.json()
}

async function copyText(text: string | null): Promise<boolean> {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy token:', err)
    return false
  }
}

function readStored<T extends string>(key: string, fallback: T): T {
  if (globalThis.window === undefined) return fallback
  return (localStorage.getItem(key) as T) || fallback
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => readStored('organization-view-mode', 'grid'))
  
  // Initialize density from localStorage
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => readStored('organization-card-density', 'comfortable'))
  
  const router = useRouter()

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('organization-view-mode', viewMode)
    localStorage.setItem('organization-card-density', density)
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
      setError(errorText(err, 'Unknown error'))
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
      await apiJson(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }, 'Failed to delete organization')
      refetch()
      setShowDeleteConfirm(null)
    } catch (error: unknown) {
      console.error('Error deleting organization:', error)
      const errorMessage = errorText(error, 'Failed to delete organization')
      alert(`Failed to delete organization: ${errorMessage}`)
    } finally {
      setDeletingProject(null)
    }
  }

  const handleRegenerateToken = async (project: Project) => {
    setRegeneratingToken(project.id)
    try {
      const result = await apiJson(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_token' }),
      }, 'Failed to regenerate token')
      setRegeneratedToken(result.api_token)
      setShowTokenDialog(project)
      setShowRegenerateConfirm(null)
      refetch()
    } catch (error: unknown) {
      console.error('Error regenerating token:', error)
      const errorMessage = errorText(error, 'Failed to regenerate token')
      alert(`Failed to regenerate token: ${errorMessage}`)
    } finally {
      setRegeneratingToken(null)
    }
  }

  const handleCopyToken = async () => {
    if (await copyText(regeneratedToken)) {
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  const handleCloseTokenDialog = () => {
    setShowTokenDialog(null)
    setRegeneratedToken(null)
    setShowToken(false)
    setTokenCopied(false)
  }

  const filteredProjects = filterProjects(projects, searchQuery)

  // Comfortable Card Component (Original Style)
  const ComfortableCard = ({ project }: { project: Project }) => (
    <Card
      className={`group bg-card  border border-border  hover:border-border  hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer ${
        selectedProject === project.id ? 'opacity-50 scale-[0.98]' : ''
      }`}
      onClick={() => handleProjectClick(project)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded flex items-center justify-center text-primary-foreground font-medium text-xs flex-shrink-0">
              {getOrganisationInitials(project.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-foreground text-sm truncate">{project.name}</h3>
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
                  <Badge variant="outline" className="text-xs font-normal bg-success/10 text-success border-success/30 px-1.5 py-0">
                    <Key className="h-2 w-2 mr-0.5" />
                    API
                  </Badge>
                )}
                {project.agent_count !== undefined && (
                  <Badge variant="outline" className="text-xs font-normal bg-primary/10 text-primary border-primary/30 px-1.5 py-0">
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
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-muted-foreground hover:text-muted-foreground hover:bg-muted"
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
              }} className="text-xs text-destructive focus:text-destructive">
                <Trash2 className="h-3 w-3 mr-2" />
                Delete organization
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formatDate(project.created_at)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
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
      className={`group bg-card  border border-border  hover:border-border  hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer ${
        selectedProject === project.id ? 'opacity-50 scale-[0.98]' : ''
      }`}
      onClick={() => handleProjectClick(project)}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 bg-gradient-to-br from-primary to-primary/80 rounded flex items-center justify-center text-primary-foreground font-medium text-xs flex-shrink-0">
              {getOrganisationInitials(project.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <h3 className="font-medium text-foreground text-sm truncate">{project.name}</h3>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${project.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-xs font-normal border ${getEnvironmentColor(project.environment)} px-1.5 py-0 h-4`}>
                  {project.environment}
                </Badge>
                {project.token_hash && (
                  <Badge variant="outline" className="text-xs font-normal bg-success/10 text-success border-success/30 px-1.5 py-0 h-4">
                    <Key className="h-2 w-2 mr-0.5" />
                    API
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{project.agent_count} agents</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{formatDate(project.created_at)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-muted-foreground hover:text-muted-foreground hover:bg-muted"
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
                }} className="text-xs text-destructive focus:text-destructive">
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const CurrentCardComponent = density === 'compact' ? CompactCard : ComfortableCard

  if (loading || !isAuthLoaded) {
    return (
      <div className="h-full bg-background flex flex-col">
        <div className="max-w-7xl mx-auto px-6 py-6 w-full shrink-0">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-3 w-80" />
              </div>
              <Skeleton className="h-8 w-28" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-7 w-16" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-100 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
          <div className="max-w-7xl mx-auto px-6 pb-6">
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Skeleton className="w-8 h-8 shrink-0" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="w-1.5 h-1.5 rounded-full" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Skeleton className="h-4 w-12 rounded-full" />
                            <Skeleton className="h-4 w-8 rounded-full" />
                          </div>
                        </div>
                      </div>
                      <Skeleton className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 mb-4">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-1">
                        <Skeleton className="w-3 h-3" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="w-3 h-3" />
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
      <div className="h-full bg-card flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">Failed to load organizations</h3>
              <p className="text-xs text-muted-foreground">{error}</p>
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
    <div className="h-full bg-card flex flex-col">
      <div className="max-w-7xl mx-auto px-6 py-6 w-full">
        {/* Fixed Header */}
        <div className="mb-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Organizations</h1>
                <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                  {projects.length}
                </Badge>
              </div>
             {!isMobile && <p className="text-xs text-muted-foreground">
                Organize agents by team. Each organization provides isolated access and analytics.
              </p>}
            </div>
            <Button 
              onClick={handleCreateProject}
              size="sm"
              className={`bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs h-8 ${isMobile ? 'px-3 py-0' : 'px-3 py-1.5'}`}
            >
              <Plus className={`w-3 h-3 ${isMobile ? '' : 'mr-1.5'}`} />
              {isMobile ? '' : 'New Organization'}
            </Button>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${isMobile ? 'w-full' : 'w-64'} pl-7 pr-3 py-1.5 text-xs border border-border rounded bg-muted/50 text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-all focus:bg-card`}
                />
              </div>
            </div>
            
            <ViewControls
              viewMode={viewMode}
              onViewMode={setViewMode}
              density={density}
              onDensity={setDensity}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-100 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
        <div className="max-w-7xl mx-auto px-6 pb-6">
          {/* Content Grid/Table */}
          {viewMode === 'list' ? (
            // Table View
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              {/* Table Header */}
              <div className="px-6 py-3 bg-muted/50 border-b border-border">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-foreground">
                  <div className="col-span-6">Organization Name</div>
                  <div className="col-span-2">Environment</div>
                  <div className="col-span-2">Created</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
              </div>
              
              {/* Table Body */}
              <div>
                {filteredProjects.map((project, index) => (
                  <div // NOSONAR typescript:S6819 — nested interactive controls, cannot be a native button
                    key={project.id}
                    className={`group px-6 py-4 hover:bg-muted/50  transition-colors cursor-pointer ${
                      index === filteredProjects.length - 1 ? '' : 'border-b border-border'
                    } ${selectedProject === project.id ? 'opacity-50' : ''}`}
                    onClick={() => handleProjectClick(project)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleProjectClick(project) } }}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Organization */}
                      <div className="col-span-6 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded flex items-center justify-center text-primary-foreground font-medium text-xs flex-shrink-0">
                          {getOrganisationInitials(project.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground text-sm truncate">{project.name}</h3>
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${project.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                            {project.token_hash && (
                              <Badge variant="outline" className="text-xs font-normal bg-success/10 text-success border-success/30 px-1.5 py-0 h-4">
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
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-muted-foreground hover:text-muted-foreground hover:bg-muted"
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
                            }} className="text-xs text-destructive focus:text-destructive">
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete organization
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
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
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">No organizations found</h3>
              <p className="text-xs text-muted-foreground mb-6 max-w-md mx-auto">
                No organizations match "<span className="font-medium text-gray-900 dark:text-gray-100">{searchQuery}</span>". 
                Try different search terms.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground border-border text-xs h-7 hover:bg-muted/50"
              >
                Clear search
              </Button>
            </div>
          )}

          {projects.length === 0 && !loading && !error && (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Create your first organization</h3>
              <p className="text-xs text-muted-foreground mb-6 max-w-lg mx-auto">
                Organize agents by team. Each organization provides isolated access control and analytics.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={handleCreateProject}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Create organization
                </Button>
                <div className="text-xs text-muted-foreground max-w-sm mx-auto">
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

      <TokenDialog
        project={showTokenDialog}
        token={regeneratedToken}
        visible={showToken}
        copied={tokenCopied}
        onToggleVisible={() => setShowToken(!showToken)}
        onCopy={handleCopyToken}
        onClose={handleCloseTokenDialog}
      />

      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete organization</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
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