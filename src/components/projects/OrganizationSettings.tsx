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
  RefreshCw,
  UserX,
  Search
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
  status: 'active' | 'pending' | 'inactive'
  joinedAt: string
  permissions?: Record<string, unknown>
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
  const { data: membersData, isLoading: loadingMembers, error: membersError, refetch: refetchMembers } = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${organizationId}/members`)
      if (!response.ok) {
        throw new Error('Failed to fetch members')
      }
      const data = await response.json()
      return data
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
        status: m.is_active === false ? 'inactive' : 'active',
        joinedAt: m.joined_at || m.created_at,
        permissions: m.permissions,
      }))
      setTeamMembers(activeMembers)
    }

    if (membersData?.pending_mappings) {
      const pending: TeamMember[] = membersData.pending_mappings.map((m: any) => ({
        id: m.id.toString(),
        email: m.email,
        role: m.role,
        status: 'pending' as const,
        joinedAt: m.created_at,
        permissions: m.permissions,
      }))
      setPendingMembers(pending)
    }
  }, [membersData])

  // Invite member states
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'viewer'>('viewer')
  const [isInviting, setIsInviting] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)

  // Delete organization states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Remove member state
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft')


  const currentUserRole = membersData?.currentUserRole || teamMembers.find(
    m => m.email === user?.emailAddresses?.[0]?.emailAddress
  )?.role || pendingMembers.find(
    m => m.email === user?.emailAddresses?.[0]?.emailAddress
  )?.role || 'member'

  const canManageMembers = ['owner', 'admin'].includes(currentUserRole)
  const canDeleteOrg = currentUserRole === 'owner' && organizations.length > 0

  // Combined list of all members for display
  const allMembers = [...teamMembers, ...pendingMembers]

  const [memberSearch, setMemberSearch] = useState('')
  const filteredMembers = memberSearch.trim()
    ? allMembers.filter((m) => m.email.toLowerCase().includes(memberSearch.trim().toLowerCase()))
    : allMembers

  const handleInviteMember = async () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase()

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    if (teamMembers.some(m => m.email === normalizedEmail)) {
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
          email: normalizedEmail,
          role: inviteRole
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add member')
      }

      refetchMembers()

      setInviteEmail('')
      setInviteRole('viewer')
      setShowInviteDialog(false)

      if (data.inviteSent === false) {
        if (data.type === 'direct_add') {
          toast.error(`${normalizedEmail} added to the organization, but the invite email could not be sent. Check your email configuration.`, { duration: 5000 })
        } else if (data.type === 'reactivated') {
          toast.error(`${normalizedEmail} re-added, but the invite email could not be sent. Check your email configuration.`, { duration: 5000 })
        } else {
          toast.error(`${normalizedEmail} added to pending list, but the invite email could not be sent. Check your email configuration.`, { duration: 5000 })
        }
      } else {
        if (data.type === 'direct_add') {
          toast.success(`${normalizedEmail} has been added to the organization!`)
        } else if (data.type === 'reactivated') {
          toast.success(`${normalizedEmail} has been reactivated!`)
        } else {
          toast.success(`Invitation sent to ${normalizedEmail}. They'll be added when they sign up.`)
        }
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
      case 'user':
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
      case 'user':
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

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'viewer') => {
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
    <>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Users className="w-5 h-5" />
                  Team Members
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-gray-400">
                  Manage who has access to this organization
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  {allMembers.length} {allMembers.length === 1 ? 'member' : 'members'}
                </Badge>
                {canManageMembers && (
                  <Button size="sm" onClick={() => setShowInviteDialog(true)} className="gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" />
                    Invite
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Team Members List */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current Members
                </h3>
                {allMembers.length > 5 && (
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search by email"
                      className="h-8 pl-8 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    />
                  </div>
                )}
              </div>

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
              ) : filteredMembers.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No members match &ldquo;{memberSearch}&rdquo;.</p>
              ) : (
                /* A real vh height, not flex-1/min-h-0 — that chain resolved to
                   zero on at least one real mobile browser, hiding the table
                   entirely with no error. vh is resolved against the actual
                   viewport, independent of any ancestor's height math. */
                <div className="h-[50vh] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                {/* scrollbar-thin (globals.css): the default OS scrollbar track sits
                    right where the sticky header's right edge is, and its lighter
                    track color was being mistaken for a gap in the header background. */}
                <div className="h-full overflow-auto scrollbar-thin">
                  <table className="w-full min-w-[560px] table-fixed text-sm">
                    {/* Background + border on each <th>, not the <tr> — a <tr>'s own
                        background has historically been unreliable to paint across
                        its full rendered width in some browsers once you combine
                        sticky positioning, table-layout: fixed, and a horizontally
                        scrolling ancestor (our exact combination here); per-cell
                        background can't have that problem since each cell paints
                        its own box. */}
                    <thead className="sticky top-0 z-10 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-2 font-medium border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">Member</th>
                        <th className="px-4 py-2 font-medium border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800 w-40">Role</th>
                        <th className="px-4 py-2 font-medium border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800 w-44">Status</th>
                        <th className="px-4 py-2 font-medium border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800 text-right w-44">&nbsp;</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((member) => {
                        const isCurrentUser = member.email === user?.emailAddresses?.[0]?.emailAddress
                        const canChangeRole = canManageMembers && member.role !== 'owner' && !isCurrentUser
                        const isInactive = member.status === 'inactive'

                        return (
                          <tr
                            key={member.id}
                            className={`border-b border-gray-100 last:border-0 dark:border-gray-800/70 ${isInactive ? 'opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                  {member.email.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                                  {member.email}
                                  {isCurrentUser && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">(You)</span>}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {canChangeRole && !isInactive ? (
                                <Select
                                  value={member.role}
                                  onValueChange={(value: 'admin' | 'viewer') => handleRoleChange(member.id, value)}
                                  disabled={changingRole === member.id}
                                >
                                  <SelectTrigger className={`w-[120px] h-7 text-xs ${getRoleBadgeColor(member.role)}`}>
                                    <SelectValue>
                                      <div className="flex items-center gap-1">
                                        {changingRole === member.id ? <Loader2 className="w-3 h-3 animate-spin" /> : getRoleIcon(member.role)}
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
                                    <SelectItem value="admin" className="text-xs">
                                      <div className="flex items-center gap-2">
                                        <Shield className="w-3 h-3" />
                                        Admin
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline" className={`text-xs flex w-fit items-center gap-1 ${getRoleBadgeColor(member.role)}`}>
                                  {getRoleIcon(member.role)}
                                  {member.role}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {member.status === 'inactive' && (
                                <Badge variant="outline" className="text-xs border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 flex w-fit items-center gap-1">
                                  <UserX className="w-3 h-3" />
                                  Inactive
                                </Badge>
                              )}
                              {member.status === 'pending' && (
                                <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 flex w-fit items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </Badge>
                              )}
                              {member.status === 'active' && !isInactive && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                  Joined {formatDate(member.joinedAt)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canManageMembers && member.role !== 'owner' && !isCurrentUser && (
                                isInactive ? (
                                  <div className="flex items-center justify-end gap-1">
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
                                      onClick={() => { setMemberToRemove(member.id); setDeleteType('hard') }}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 dark:hover:text-red-300 h-7 w-7 p-0"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setMemberToRemove(member.id); setDeleteType('soft') }}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 dark:hover:text-red-300 h-7 w-7 p-0"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                )
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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

      {/* Invite Team Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <UserPlus className="w-4 h-4" />
              Invite Team Member
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              They'll get an email invite to join this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
              <Select value={inviteRole} onValueChange={(value: 'admin' | 'viewer') => setInviteRole(value)}>
                <SelectTrigger id="invite-role" className="w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectItem value="viewer" className="text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      <Eye className="w-3 h-3" />
                      Viewer
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              disabled={isInviting}
              className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button onClick={handleInviteMember} disabled={isInviting}>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
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
    </>
  )
}