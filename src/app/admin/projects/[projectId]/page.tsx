// src/app/admin/projects/[projectId]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { 
  ArrowLeft, 
  Loader2, 
  Building2, 
  Users, 
  Bot, 
  Shield,
  CheckCircle2,
  XCircle,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import toast from 'react-hot-toast'

interface ProjectMember {
  id: number
  email: string
  clerk_id: string | null
  role: 'owner' | 'admin' | 'member'
  permissions: {
    read: boolean
    write: boolean
    delete: boolean
    admin: boolean
    can_create_agents?: boolean
  }
  is_active: boolean
  created_at: string
}

interface Project {
  id: string
  name: string
  description: string
  agent: {
    usage: {
      active_count: number
    }
    agents: any[]
    limits: {
      max_agents: number
    }
  }
  plans: {
    type: 'FREE' | 'BETA' | 'PAID'
    level: number
  }
  owner_email: string
}

export default function AdminProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const { user: clerkUser, isLoaded } = useUser()
  const queryClient = useQueryClient()
  
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<Record<number, boolean>>({})

  // Check if user is SUPERADMIN
  useEffect(() => {
    const checkAccess = async () => {
      if (!isLoaded) return
      
      if (!clerkUser?.id) {
        router.push('/unauthorized')
        return
      }

      try {
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

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['admin', 'project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch project')
      const data = await response.json()
      return data.data as Project
    },
    enabled: isAuthorized === true && !!projectId,
    staleTime: 30000,
  })

  // Fetch project members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['admin', 'project-members', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/projects/${projectId}/members`)
      if (!response.ok) throw new Error('Failed to fetch members')
      const data = await response.json()
      return data.members as ProjectMember[]
    },
    enabled: isAuthorized === true && !!projectId,
    staleTime: 30000,
  })

  // Update member permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ memberId, canCreateAgents }: { memberId: number; canCreateAgents: boolean }) => {
      const response = await fetch(`/api/admin/projects/${projectId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          can_create_agents: canCreateAgents
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update permission')
      }
      
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'project-members', projectId] })
      toast.success('Permission updated successfully')
      
      // Remove from edited permissions
      setEditedPermissions(prev => {
        const newState = { ...prev }
        delete newState[variables.memberId]
        return newState
      })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const handlePermissionToggle = (memberId: number, currentValue: boolean) => {
    setEditedPermissions(prev => ({
      ...prev,
      [memberId]: !currentValue
    }))
  }

  const handleSavePermission = (member: ProjectMember) => {
    const newValue = editedPermissions[member.id]
    if (newValue === undefined) return

    updatePermissionMutation.mutate({
      memberId: member.id,
      canCreateAgents: newValue
    })
  }

  const hasUnsavedChanges = (memberId: number) => {
    return editedPermissions[memberId] !== undefined
  }

  const getCurrentPermissionValue = (member: ProjectMember) => {
    return editedPermissions[member.id] ?? (member.permissions.can_create_agents || false)
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
      case 'admin': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'PAID': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      case 'BETA': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    }
  }

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

  const isLoading = projectLoading || membersLoading

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back Button */}
      <Button
        onClick={() => router.push('/admin/projects')}
        variant="ghost"
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Projects
      </Button>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Content */}
      {!isLoading && project && members && (
        <div className="space-y-6">
          {/* Project Header */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {project.name}
                  </h1>
                  <span className={`text-xs px-2 py-1 rounded-full ${getPlanBadgeColor(project.plans.type)}`}>
                    {project.plans.type}
                  </span>
                </div>

                {project.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        <span>
                        {project.agent?.usage?.active_count ?? 0}/{project.agent?.limits?.max_agents ?? 0} agents
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        Owner: {project.owner_email}
                    </div>
                    </div>
              </div>
            </div>
          </div>

          {/* Members Section */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Project Members
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage member permissions for agent creation
              </p>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {members.map((member) => {
                const currentValue = getCurrentPermissionValue(member)
                const hasChanges = hasUnsavedChanges(member.id)
                const isPending = updatePermissionMutation.isPending

                return (
                  <div key={member.id} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {member.email}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(member.role)}`}>
                            {member.role}
                          </span>
                          {!member.clerk_id && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {member.clerk_id ? 'Active member' : 'Invitation sent'}
                        </p>
                      </div>

                      {/* Permission Controls */}
                      {member.role !== 'owner' && project.plans.type !== 'FREE' ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={currentValue}
                              onCheckedChange={() => handlePermissionToggle(member.id, currentValue)}
                              disabled={isPending}
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              Can Create Agents
                            </span>
                          </div>

                          {hasChanges && (
                            <Button
                              onClick={() => handleSavePermission(member)}
                              disabled={isPending}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  Save
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      ) : member.role === 'owner' ? (
                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                          <Shield className="w-4 h-4" />
                          <span className="text-sm font-medium">Project Owner</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-sm">FREE Plan - No Agents</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {members.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No members found in this project
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          {project.plans.type === 'FREE' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                    FREE Plan Project
                  </h4>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    This project is on the FREE plan. Upgrade the project plan to BETA or PAID in the Projects list to enable agent creation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}