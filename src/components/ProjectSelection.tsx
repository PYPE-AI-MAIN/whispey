'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  ChevronRight, 
  Bot,
  Settings, 
  Loader2, 
  AlertCircle,
  Search,
  Plus,
  Folder
} from 'lucide-react'
import { useSupabaseQuery } from '../../hooks/useSupabase'
import Image from 'next/image'

interface Project {
  id: string
  name: string
  description: string
  environment: string
  created_at: string
  is_active: boolean
}

interface ProjectSelectionProps {
  // No props needed - this component handles its own navigation
}

const ProjectSelection: React.FC<ProjectSelectionProps> = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  const { data: projects, loading, error } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active',
    orderBy: { column: 'created_at', ascending: false },
    filters: [{ column: 'is_active', operator: 'eq', value: true }]
  })

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project.id)
    setTimeout(() => {
      router.push(`/${project.id}/agents`)
    }, 150)
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {filteredProjects.map((project) => {
              const color = getProjectColor(project.name)
              return (
                <Card
                  key={project.id}
                  className={`group cursor-pointer border-0 bg-gray-50/50 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-gray-200/50 ${
                    selectedProject === project.id 
                      ? 'scale-[0.98] opacity-60' 
                      : ''
                  }`}
                  onClick={() => handleProjectClick(project)}
                >
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <Avatar className={`h-12 w-12 ${getProjectIcon(color)}`}>
                        <AvatarFallback className={`${getProjectIcon(color)} text-white`}>
                          <Folder className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      
                      <ChevronRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1" />
                    </div>

                    {/* Project Info */}
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {project.description}
                      </p>
                    </div>

                    {/* Status & Date */}
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant={project.environment === 'production' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {project.environment}
                      </Badge>
                      
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        <span className="text-xs text-gray-600">Active</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Add New Project Card */}
            <Card className="group cursor-pointer border-2 border-dashed border-gray-200 bg-transparent transition-all duration-200 hover:border-gray-300 hover:bg-gray-50/50">
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
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default ProjectSelection