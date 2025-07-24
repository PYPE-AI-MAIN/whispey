'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import TokenRegenerationConfirmDialog from './TokenRegenerationConfirmDialog'

import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ChevronRight, 
  Bot,
  Settings, 
  Loader2, 
  AlertCircle,
  Search,
  Plus,
  Folder,
  MoreHorizontal,
  Trash2,
  Key,
  Copy,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react'
import { useSupabaseQuery } from '../../hooks/useSupabase'
import ProjectCreationDialog from './ProjectCreationDialog'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Project {
  id: string
  name: string
  description: string
  environment: string
  created_at: string
  is_active: boolean
  token_hash?: string
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
  const [showToken, setShowToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<Project | null>(null)

  const router = useRouter()

  const { data: projects, loading, error, refetch } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active, token_hash',
    orderBy: { column: 'created_at', ascending: false },
    filters: [{ column: 'is_active', operator: 'eq', value: true }]
  })

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
    // Refresh the projects list to include the new project
    refetch()
    
    // Optionally navigate to the new project immediately
    setTimeout(() => {
      router.push(`/${newProject.id}/agents`)
    }, 500)
  }

  const handleDeleteProject = async (project: Project) => {
    setDeletingProject(project.id)
    
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete project')
      }

      const result = await response.json()
      console.log('Project deleted successfully:', result)
      
      // Refresh the projects list
      refetch()
      setShowDeleteConfirm(null)
      
    } catch (error: unknown) {
      console.error('Error deleting project:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete project'
      alert(`Failed to delete project: ${errorMessage}`)
    } finally {
      setDeletingProject(null)
    }
  }

  const handleRegenerateToken = async (project: Project) => {
    setRegeneratingToken(project.id)
    
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'regenerate_token'
        }),
      })
  
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to regenerate token')
      }
  
      const result = await response.json()
      setRegeneratedToken(result.api_token)
      setShowTokenDialog(project)
      setShowRegenerateConfirm(null) // Close confirmation dialog
      console.log('Token regenerated successfully for project:', project.name)
      
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

  const getProjectColor = (name: string) => {
    const colors = ['blue', 'green', 'purple', 'orange', 'pink']
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  const getProjectIcon = (color: string) => {
    const colorClasses = {
      blue: "bg-blue-500",
      green: "bg-green-500", 
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      pink: "bg-pink-500"
    }
    return colorClasses[color as keyof typeof colorClasses] || "bg-gray-500"
  }

  // Filter projects based on search
  const filteredProjects = projects?.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
          <p className="text-gray-600 max-w-md">
            Unable to load projects: {error}
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Simple Header */}
      <header className="px-6 py-8">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className='flex items-center gap-2'>
            <Image src="/pype_ai_logo.jpeg" alt="Pype AI Logo" width={80} height={80} />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Pype Voice</h1>
              <p className="text-gray-500 mt-1">Voice AI Platform</p>
            </div>
          </div>
          
          <Button variant="ghost" size="sm">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-light text-gray-900 mb-3">
              Choose Project
            </h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Select a project to view agents and call analytics
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border-0 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder:text-gray-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0"
              />
            </div>
          </div>

          {/* Project Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {filteredProjects.map((project) => {
              const color = getProjectColor(project.name)
              
              return (
                <Card
                  key={project.id}
                  className={`group border-0 bg-gray-50/50 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-gray-200/50 ${
                    selectedProject === project.id 
                      ? 'scale-[0.98] opacity-60' 
                      : ''
                  }`}
                >
                  <CardContent className="p-6">
                    {/* Header with Actions */}
                    <div className="flex items-start justify-between mb-4">
                      <Avatar className={`h-12 w-12 ${getProjectIcon(color)}`}>
                        <AvatarFallback className={`${getProjectIcon(color)} text-white`}>
                          <Folder className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowRegenerateConfirm(project) // Show confirmation instead of direct regeneration
                            }}
                            disabled={regeneratingToken === project.id}
                          >
                            {regeneratingToken === project.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Regenerate Token
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowDeleteConfirm(project)
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Content */}
                    <div className="space-y-4" onClick={() => handleProjectClick(project)}>
                      {/* Project Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">
                          {project.name}
                        </h3>
                        {project.description && (
                          <p className="text-gray-600 text-sm line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>

                      {/* Project Details */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            {project.environment}
                          </Badge>
                          {project.token_hash && (
                            <Badge variant="outline" className="text-xs">
                              <Key className="h-3 w-3 mr-1" />
                              API Enabled
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      </div>

                      {/* Creation Date */}
                      <p className="text-xs text-gray-500">
                        Created {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Create New Project Card */}
            <Card 
              className="group cursor-pointer border-2 border-dashed border-gray-200 bg-transparent transition-all duration-200 hover:border-gray-300 hover:bg-gray-50/50"
              onClick={handleCreateProject}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 min-h-[200px]">
                <div className="rounded-full bg-gray-100 p-3 mb-3 group-hover:bg-gray-200 transition-colors">
                  <Plus className="h-6 w-6 text-gray-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">New Project</h3>
                <p className="text-sm text-gray-600 text-center">
                  Create a new voice AI project
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Empty State */}
          {filteredProjects.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your search or create a new project
              </p>
              <Button variant="outline" onClick={handleCreateProject}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Project Creation Dialog */}
      <ProjectCreationDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* Token Display Dialog */}
      <Dialog open={showTokenDialog !== null} onOpenChange={handleCloseTokenDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New API Token Generated</DialogTitle>
            <DialogDescription>
              A new API token has been generated for project "{showTokenDialog?.name}".
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* API Token */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={regeneratedToken || ''}
                  readOnly
                  className="w-full h-11 px-4 pr-20 text-sm border border-gray-300 rounded-lg bg-gray-50 font-mono"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowToken(!showToken)}
                    className="h-7 w-7 p-0"
                  >
                    {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyToken}
                    className="h-7 w-7 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {tokenCopied && (
                <p className="text-xs text-green-600 mt-1">Token copied to clipboard!</p>
              )}
            </div>

            {/* Warning */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>Important:</strong> This token will only be shown once. Please save it in a secure location.
                The previous token is now invalid.
              </p>
            </div>

            {/* Close Button */}
            <div className="pt-4">
              <Button onClick={handleCloseTokenDialog} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{showDeleteConfirm?.name}"? This action cannot be undone and will delete all associated agents, call logs, and data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-3 pt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDeleteProject(showDeleteConfirm)}
              disabled={deletingProject !== null}
              className="flex-1"
            >
              {deletingProject ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete Project
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
    </div>
  )
}

export default ProjectSelection