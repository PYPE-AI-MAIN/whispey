'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import TokenRegenerationConfirmDialog from '../TokenRegenerationConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ChevronRight, Settings, Loader2, AlertCircle, Search, Plus, FolderOpen, MoreHorizontal, Trash2, Key, Copy, Eye, EyeOff, RefreshCw, Users, Clock, Filter, SortDesc, Grid3X3, List, ExternalLink, Building2, Folder } from 'lucide-react'
import ProjectCreationDialog from './ProjectCreationDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import MemberManagementDialog from '../MemberManagmentDialog'
import Header from '../shared/Header'

interface Project {
  id: string
  name: string
  description: string
  environment: string
  created_at: string
  is_active: boolean
  token_hash?: string
  agent_count?: number // Adding agent count for workspace context
}

interface ProjectSelectionProps {}

const ProjectSelection: React.FC<ProjectSelectionProps> = () => {
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const router = useRouter()

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
  }, [])


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
      
      // Refresh the projects list
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
      setShowRegenerateConfirm(null) // Close confirmation dialog
      
      // Refresh the projects list to get updated token_hash
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
        return 'bg-red-50 text-red-700 border-red-200'
      case 'staging':
      case 'stage':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'development':
      case 'dev':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
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

  if (loading) {
    return (
      <div className="min-h-screen bg-project-gradient">
        <div className="absolute inset-0 bg-subtle-pattern opacity-60"></div>
        <div className="relative z-10">
          <Header />
          <div className="flex items-center justify-center py-32">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-900">Loading workspaces</h3>
                <p className="text-xs text-gray-500">This should only take a moment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-project-gradient">
        <div className="absolute inset-0 bg-subtle-pattern opacity-60"></div>
        <div className="relative z-10">
          <Header />
          <div className="flex items-center justify-center py-32">
            <div className="text-center space-y-6 max-w-sm">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-900">Failed to load workspaces</h3>
                <p className="text-xs text-gray-500">{error}</p>
              </div>
              <Button 
                onClick={() => window.location.reload()} 
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2"
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-project-gradient">
      <div className="absolute inset-0 bg-subtle-pattern opacity-60"></div>
      <div className="relative z-10">
        <Header />
        
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          {/* Updated Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-semibold text-gray-900">Workspaces</h1>
                </div>
                <p className="text-sm text-gray-600">
                  Organize your voice agents by department or team. Each workspace provides isolated access control and dedicated analytics.
                </p>
              </div>
              <Button 
                onClick={handleCreateProject}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Workspace
              </Button>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    placeholder="Search workspaces..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-80 pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  />
                </div>
                <Button variant="outline" size="sm" className="text-gray-600 border-gray-200 hover:bg-gray-50">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
                <Button variant="outline" size="sm" className="text-gray-600 border-gray-200 hover:bg-gray-50">
                  <SortDesc className="w-4 h-4 mr-2" />
                  Sort
                </Button>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-gray-200 rounded-lg p-1 bg-gray-50">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className={`w-8 h-8 p-0 ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-transparent'}`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={`w-8 h-8 p-0 ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-transparent'}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Workspace Grid */}
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className={`group bg-white/80 backdrop-blur-sm border border-gray-200/60 hover:border-gray-300 hover:shadow-lg hover:bg-white transition-all duration-200 cursor-pointer ${
                  selectedProject === project.id ? 'opacity-50 scale-[0.98]' : ''
                }`}
                onClick={() => handleProjectClick(project)}
              >
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 relative">
                        {getWorkspaceInitials(project.name)}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <FolderOpen className="w-2 h-2 text-indigo-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 text-base truncate">{project.name}</h3>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${project.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs font-medium border ${getEnvironmentColor(project.environment)}`}
                          >
                            {project.environment}
                          </Badge>
                          {project.token_hash && (
                            <Badge variant="outline" className="text-xs font-medium bg-green-50 text-green-700 border-green-200">
                              <Key className="h-3 w-3 mr-1" />
                              API
                            </Badge>
                          )}
                          {project.agent_count !== undefined && (
                            <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                              {project.agent_count} {project.agent_count === 1 ? 'agent' : 'agents'}
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
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProjectForDialog(project)
                          setShowAddMemberDialog(true)
                        }}>
                          <Users className="h-4 w-4 mr-2" />
                          Manage access
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                        }}>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          setShowRegenerateConfirm(project)
                        }} disabled={regeneratingToken === project.id}>
                          {regeneratingToken === project.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Regenerate token
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          setShowDeleteConfirm(project)
                        }} className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-sm text-gray-600 mb-6 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>Created {formatDate(project.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-blue-600 transition-colors">
                      <span>Open workspace</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State for Search */}
          {filteredProjects.length === 0 && searchQuery && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No workspaces found</h3>
              <p className="text-sm text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                We couldn't find any workspaces matching "<span className="font-medium text-gray-900">{searchQuery}</span>". 
                Try adjusting your search terms.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery('')}
                className="text-gray-600 border-gray-300"
              >
                Clear search
              </Button>
            </div>
          )}

          {/* Empty State for No Workspaces */}
          {projects.length === 0 && !loading && !error && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Create your first workspace</h3>
              <p className="text-sm text-gray-600 mb-8 max-w-lg mx-auto leading-relaxed">
                Organize your voice agents by department or team. Each workspace provides isolated access control, 
                dedicated analytics, and team-specific agent management.
              </p>
              <div className="space-y-4">
                <Button 
                  onClick={handleCreateProject}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create workspace
                </Button>
                <div className="text-xs text-gray-500 max-w-sm mx-auto">
                  <p><strong>Example:</strong> Create "Sales Department" to organize all sales-related voice agents and provide access to your sales team.</p>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Dialogs - Updated terminology */}
        <ProjectCreationDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onProjectCreated={handleProjectCreated}
        />

        <Dialog open={showTokenDialog !== null} onOpenChange={handleCloseTokenDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">API token generated</DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                A new API token has been generated for the "{showTokenDialog?.name}" workspace. Save this token securely as it won't be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">API Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={regeneratedToken || ''}
                    readOnly
                    className="w-full h-10 px-3 pr-20 text-sm border border-gray-200 rounded-lg bg-gray-50 font-mono focus:outline-none"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowToken(!showToken)}
                      className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                    >
                      {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyToken}
                      className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {tokenCopied && (
                  <p className="text-xs text-emerald-600 mt-2">Token copied to clipboard</p>
                )}
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>Important:</strong> Store this token securely. The previous token has been invalidated and will no longer work.
                </p>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleCloseTokenDialog} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Delete workspace</DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Are you sure you want to delete the "{showDeleteConfirm?.name}" workspace? This action cannot be undone and will permanently delete all agents, call logs, and analytics data in this workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 pt-6">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => showDeleteConfirm && handleDeleteProject(showDeleteConfirm)}
                disabled={deletingProject !== null}
                className="flex-1"
              >
                {deletingProject ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Delete workspace
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
    </div>
  )
}

export default ProjectSelection