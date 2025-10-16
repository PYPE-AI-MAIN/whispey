'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import toast from 'react-hot-toast'
import { 
  Settings, 
  UserPlus, 
  Trash2, 
  AlertTriangle,
  Users,
  Mail,
  Shield,
  X,
  Loader2,
  Building2,
  Clock,
  CheckCircle2,
  Crown,
  Eye,
  User,
  RefreshCw,  // ✅ ADDED
  UserX       // ✅ ADDED
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert'

interface TeamMember {
  id: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'user' | 'viewer'
  status: 'active' | 'pending' | 'inactive' // ✅ ADDED 'inactive'
  joinedAt: string
}

interface Organization {
  id: string
  name: string
  description?: string
  environment: string
  agent_count?: number
}

interface OrganizationSettingsProps {
  organizationName: string
  organizationId: string
}

// Fetch organizations function
const fetchOrganizations = async (): Promise<Organization[]> => {
  const res = await fetch('/api/projects')
  if (!res.ok) throw new Error('Failed to fetch organizations')
  return res.json()
}

export default function OrganizationSettings({ 
  organizationName,
  organizationId 
}: OrganizationSettingsProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useUser()

  // Fetch organizations to check count
  const { data: organizations = [], isLoading: loadingOrgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    staleTime: 30000,
  })

  // Fetch team members for this organization
  const { data: membersData, isLoading: loadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${organizationId}/members`)
      if (!response.ok) throw new Error('Failed to fetch members')
      return response.json()
    },
    enabled: !!organizationId,
    staleTime: 30000,
  })

  // State for team members (derived from API data)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [pendingMembers, setPendingMembers] = useState<TeamMember[]>([])

  // Update local state when API data changes
  React.useEffect(() => {
    if (membersData?.members) {
      const activeMembers: TeamMember[] = membersData.members.map((m: any) => ({
        id: m.id.toString(),
        email: m.user?.email || m.email,
        role: m.role,
        status: m.is_active === false ? 'inactive' : 'active', // ✅ FIXED
        joinedAt: m.joined_at || m.created_at
      }))
      setTeamMembers(activeMembers)
    }

    if (membersData?.pending_mappings) {
      const pending: TeamMember[] = membersData.pending_mappings.map((m: any) => ({
        id: m.id.toString(),
        email: m.email,
        role: m.role,
        status: 'pending' as const,
        joinedAt: m.created_at
      }))
      setPendingMembers(pending)
    }
  }, [membersData])

  // Invite member states
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'user' | 'viewer'>('member')
  const [isInviting, setIsInviting] = useState(false)

  // Delete organization states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Remove member state
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft') // ✅ ADDED

  const currentUserRole = teamMembers.find(
    m => m.email === user?.emailAddresses?.[0]?.emailAddress
  )?.role || pendingMembers.find(
    m => m.email === user?.emailAddresses?.[0]?.emailAddress
  )?.role || 'member'

  const canManageMembers = ['owner', 'admin'].includes(currentUserRole)
  const canDeleteOrg = currentUserRole === 'owner' && organizations.length > 0

  // Combined list of all members for display
  const allMembers = [...teamMembers, ...pendingMembers]

  const handleInviteMember = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    if (teamMembers.some(m => m.email === inviteEmail)) {
      toast.error('This user is already a member of the organization')
      return
    }

    setIsInviting(true)

    try {
      const response = await fetch(`/api/projects/${organizationId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add member')
      }

      refetchMembers()
      
      setInviteEmail('')
      setInviteRole('member')

      if (data.type === 'direct_add') {
        toast.success(`${inviteEmail} has been added to the organization!`)
      } else if (data.type === 'reactivated') {
        toast.success(`${inviteEmail} has been reactivated!`)
      } else {
        toast.success(`Invitation sent to ${inviteEmail}. They'll be added when they sign up.`)
      }
    } catch (error) {
      console.error('Error inviting member:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation'
      toast.error(errorMessage)
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string, permanent: boolean = false) => {
    setIsRemoving(true)
  
    try {
      const url = `/api/projects/${organizationId}/members/${memberId}${permanent ? '?permanent=true' : ''}`
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })
  
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove member')
      }
  
      const result = await response.json()
      
      refetchMembers()
      setMemberToRemove(null)
  
      if (result.type === 'permanent_delete') {
        toast.success('Member permanently removed')
      } else {
        toast.success('Member access removed (can be reactivated)')
      }
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove member')
    } finally {
      setIsRemoving(false)
    }
  }

  const handleReactivateMember = async (member: TeamMember) => {
    try {
      const response = await fetch(`/api/projects/${organizationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: member.email,
          role: member.role
        })
      })
  
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reactivate member')
      }
  
      refetchMembers()
      toast.success(`${member.email} has been reactivated!`)
    } catch (error) {
      console.error('Error reactivating member:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate member')
    }
  }

  const handleDeleteOrganization = async () => {
    if (deleteConfirmation !== organizationName) {
      toast.error('Please type the organization name exactly as shown')
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/projects/${organizationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete organization')
      }

      const otherOrgs = organizations.filter(org => org.id !== organizationId)
      
      let redirectOrgId = otherOrgs[0]?.id
      if (typeof window !== 'undefined') {
        const lastVisitedOrgId = localStorage.getItem('whispey-last-org')
        const lastVisitedOrg = otherOrgs.find(org => org.id === lastVisitedOrgId)
        if (lastVisitedOrg) {
          redirectOrgId = lastVisitedOrg.id
        }
        
        if (lastVisitedOrgId === organizationId) {
          localStorage.removeItem('whispey-last-org')
        }
      }

      queryClient.invalidateQueries({ queryKey: ['organizations'] })

      toast.success('Organization deleted successfully')

      await new Promise(resolve => setTimeout(resolve, 500))

      if (redirectOrgId) {
        router.push(`/${redirectOrgId}/agents`)
      } else {
        router.push('/projects')
      }
    } catch (error) {
      console.error('Error deleting organization:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete organization'
      toast.error(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800'
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      case 'member':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
      case 'user':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800'
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3 h-3" />
      case 'admin':
        return <Shield className="w-3 h-3" />
      case 'member':
        return <Users className="w-3 h-3" />
      case 'user':
        return <User className="w-3 h-3" />
      case 'viewer':
        return <Eye className="w-3 h-3" />
      default:
        return <Users className="w-3 h-3" />
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

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member' | 'user' | 'viewer') => {
    setChangingRole(memberId)
  
    try {
      const response = await fetch(`/api/projects/${organizationId}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })
  
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update role')
      }
  
      refetchMembers()
  
      toast.success('Member role updated successfully')
    } catch (error) {
      console.error('Error updating role:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update role'
      toast.error(errorMessage)
    } finally {
      setChangingRole(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Organization Settings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Building2 className="w-3 h-3" />
              {organizationName}
            </p>
          </div>
        </div>

        {/* Team Management Section */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Users className="w-5 h-5" />
                  Team Members
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-gray-400">
                  Manage who has access to this organization
                </CardDescription>
              </div>
              <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {allMembers.length} {allMembers.length === 1 ? 'member' : 'members'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Invite New Member */}
            {canManageMembers && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Invite Team Member
                </h3>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <div className="space-y-1">
                    <Label htmlFor="invite-email" className="text-xs text-gray-700 dark:text-gray-300">Email Address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="invite-role" className="text-xs text-gray-700 dark:text-gray-300">Role</Label>
                    <Select value={inviteRole} onValueChange={(value: 'admin' | 'member' | 'user' | 'viewer') => setInviteRole(value)}>
                      <SelectTrigger id="invite-role" className="w-[130px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <SelectItem value="viewer" className="text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <Eye className="w-3 h-3" />
                            Viewer
                          </div>
                        </SelectItem>
                        <SelectItem value="user" className="text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3" />
                            User
                          </div>
                        </SelectItem>
                        <SelectItem value="member" className="text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <Users className="w-3 h-3" />
                            Member
                          </div>
                        </SelectItem>
                        <SelectItem value="admin" className="text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <Shield className="w-3 h-3" />
                            Admin
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleInviteMember} 
                      disabled={isInviting}
                      className="w-full md:w-auto"
                    >
                      {isInviting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Add User
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Separator className="bg-gray-200 dark:bg-gray-800" />

            {/* Team Members List */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Current Members
              </h3>
              
              {loadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading members...</span>
                </div>
              ) : allMembers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No members yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allMembers.map((member) => {
                    const isCurrentUser = member.email === user?.emailAddresses?.[0]?.emailAddress
                    const canChangeRole = canManageMembers && member.role !== 'owner' && !isCurrentUser
                    const isInactive = member.status === 'inactive'
                    
                    return (
                      <div
                        key={member.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isInactive 
                            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 opacity-75' 
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                            {member.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {member.email}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(You)</span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {canChangeRole && !isInactive ? (
                                <Select 
                                  value={member.role} 
                                  onValueChange={(value: 'admin' | 'member' | 'user' | 'viewer') => handleRoleChange(member.id, value)}
                                  disabled={changingRole === member.id}
                                >
                                  <SelectTrigger className={`w-[130px] h-6 text-xs ${getRoleBadgeColor(member.role)}`}>
                                    <SelectValue>
                                      <div className="flex items-center gap-1">
                                        {changingRole === member.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          getRoleIcon(member.role)
                                        )}
                                        {member.role}
                                      </div>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                    <SelectItem value="viewer" className="text-xs">
                                      <div className="flex items-center gap-2">
                                        <Eye className="w-3 h-3" />
                                        Viewer
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="user" className="text-xs">
                                      <div className="flex items-center gap-2">
                                        <User className="w-3 h-3" />
                                        User
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="member" className="text-xs">
                                      <div className="flex items-center gap-2">
                                        <Users className="w-3 h-3" />
                                        Member
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="admin" className="text-xs">
                                      <div className="flex items-center gap-2">
                                        <Shield className="w-3 h-3" />
                                        Admin
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline" className={`text-xs flex items-center gap-1 ${getRoleBadgeColor(member.role)}`}>
                                  {getRoleIcon(member.role)}
                                  {member.role}
                                </Badge>
                              )}
                              
                              {/* ✅ UPDATED STATUS BADGES */}
                              {member.status === 'inactive' && (
                                <Badge variant="outline" className="text-xs border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                  <UserX className="w-3 h-3" />
                                  Inactive
                                </Badge>
                              )}
                              
                              {member.status === 'pending' && (
                                <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </Badge>
                              )}
                              
                              {member.status === 'active' && !isInactive && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                  Joined {formatDate(member.joinedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ✅ UPDATED ACTION BUTTONS */}
                        {canManageMembers && member.role !== 'owner' && !isCurrentUser && (
                          <div className="flex items-center gap-1">
                            {isInactive ? (
                              // Inactive member actions
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReactivateMember(member)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 dark:text-green-400 dark:hover:text-green-300 h-7 px-2 text-xs"
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Reactivate
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setMemberToRemove(member.id)
                                    setDeleteType('hard')
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 dark:hover:text-red-300 h-6 w-6 p-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              // Active member actions
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setMemberToRemove(member.id)
                                  setDeleteType('soft')
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Role Permissions Info */}
        {/* <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-gray-100">
              <Shield className="w-5 h-5" />
              Role Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 items-start">
                <Badge variant="outline" className={getRoleBadgeColor('owner')}>
                  <Crown className="w-3 h-3 mr-1" />
                  Owner
                </Badge>
                <p className="text-gray-600 dark:text-gray-400 flex-1">
                  Full access including organization deletion and owner transfer
                </p>
              </div>
              <div className="flex gap-3 items-start">
                <Badge variant="outline" className={getRoleBadgeColor('admin')}>
                  <Shield className="w-3 h-3 mr-1" />
                  Admin
                </Badge>
                <p className="text-gray-600 dark:text-gray-400 flex-1">
                  Manage members, agents, and organization settings. Can read, write, and delete
                </p>
              </div>
              <div className="flex gap-3 items-start">
                <Badge variant="outline" className={getRoleBadgeColor('member')}>
                  <Users className="w-3 h-3 mr-1" />
                  Member
                </Badge>
                <p className="text-gray-600 dark:text-gray-400 flex-1">
                  Can read and write agents, call logs, and configurations
                </p>
              </div>
              <div className="flex gap-3 items-start">
                <Badge variant="outline" className={getRoleBadgeColor('user')}>
                  <User className="w-3 h-3 mr-1" />
                  User
                </Badge>
                <p className="text-gray-600 dark:text-gray-400 flex-1">
                  Basic read-only access to agents and call logs
                </p>
              </div>
              <div className="flex gap-3 items-start">
                <Badge variant="outline" className={getRoleBadgeColor('viewer')}>
                  <Eye className="w-3 h-3 mr-1" />
                  Viewer
                </Badge>
                <p className="text-gray-600 dark:text-gray-400 flex-1">
                  Read-only access to view agents and call logs
                </p>
              </div>
            </div>
          </CardContent>
        </Card> */}

        {/* Danger Zone */}
        {currentUserRole === 'owner' && (
          <Card className="border-red-200 dark:border-red-900 bg-white dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {organizations.length === 0 ? (
                <Alert className="mb-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                    You cannot delete your only organization. Create another organization first before deleting this one.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive" className="mb-4 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-800 dark:text-red-300">
                    Deleting this organization will permanently remove all agents, call logs, 
                    configurations, and team member access. This action cannot be undone.
                  </AlertDescription>
                </Alert>
              )}
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={!canDeleteOrg || loadingOrgs}
                className="w-full md:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {loadingOrgs ? 'Loading...' : 'Delete Organization'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ✅ UPDATED Remove Member Confirmation Dialog */}
      <Dialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">
              {deleteType === 'hard' ? 'Permanently Delete Member' : 'Remove Team Member'}
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              {deleteType === 'hard' ? (
                <>
                  Are you sure you want to <strong>permanently delete</strong> this member? 
                  This action cannot be undone and will remove all history.
                </>
              ) : (
                <>
                  Remove this member? Their access will be revoked but you can 
                  reactivate them later if needed.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
              className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => memberToRemove && handleRemoveMember(memberToRemove, deleteType === 'hard')}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : deleteType === 'hard' ? (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Permanently Delete
                </>
              ) : (
                'Remove Member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Delete Organization
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              This action cannot be undone. This will permanently delete the organization 
              and remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-800 dark:text-red-300">
                All agents, call logs, and configurations will be permanently deleted.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-sm text-gray-900 dark:text-gray-100">
                Type <span className="font-mono font-semibold">{organizationName}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={organizationName}
                className="font-mono bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setDeleteConfirmation('')
              }}
              disabled={isDeleting}
              className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrganization}
              disabled={deleteConfirmation !== organizationName || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Organization
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}