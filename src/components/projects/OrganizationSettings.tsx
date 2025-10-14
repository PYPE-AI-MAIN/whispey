'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Settings, 
  UserPlus, 
  Trash2, 
  AlertTriangle,
  Users,
  Mail,
  Shield,
  X,
  Loader2
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'pending'
  joinedAt: string
}

interface OrganizationSettingsProps {
  projectId: string
  organizationName: string
}

export default function OrganizationSettings({ 
  projectId, 
  organizationName 
}: OrganizationSettingsProps) {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()

  // State for team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: '1',
      email: user?.emailAddresses?.[0]?.emailAddress || '',
      role: 'owner',
      status: 'active',
      joinedAt: new Date().toISOString()
    }
  ])

  // Invite member states
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [isInviting, setIsInviting] = useState(false)

  // Delete organization states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Remove member state
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const currentUserRole = teamMembers.find(
    m => m.email === user?.emailAddresses?.[0]?.emailAddress
  )?.role || 'member'

  const canManageMembers = ['owner', 'admin'].includes(currentUserRole)
  const canDeleteOrg = currentUserRole === 'owner'

  const handleInviteMember = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      })
      return
    }

    if (teamMembers.some(m => m.email === inviteEmail)) {
      toast({
        title: 'Already invited',
        description: 'This user is already a member of the organization',
        variant: 'destructive'
      })
      return
    }

    setIsInviting(true)

    try {
      // TODO: Implement actual API call to invite member
      await new Promise(resolve => setTimeout(resolve, 1000))

      const newMember: TeamMember = {
        id: Date.now().toString(),
        email: inviteEmail,
        role: inviteRole,
        status: 'pending',
        joinedAt: new Date().toISOString()
      }

      setTeamMembers([...teamMembers, newMember])
      setInviteEmail('')
      setInviteRole('member')

      toast({
        title: 'Invitation sent',
        description: `An invitation has been sent to ${inviteEmail}`,
      })
    } catch (error) {
      toast({
        title: 'Failed to send invitation',
        description: 'Please try again later',
        variant: 'destructive'
      })
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    setIsRemoving(true)

    try {
      // TODO: Implement actual API call to remove member
      await new Promise(resolve => setTimeout(resolve, 1000))

      setTeamMembers(teamMembers.filter(m => m.id !== memberId))
      setMemberToRemove(null)

      toast({
        title: 'Member removed',
        description: 'The member has been removed from the organization',
      })
    } catch (error) {
      toast({
        title: 'Failed to remove member',
        description: 'Please try again later',
        variant: 'destructive'
      })
    } finally {
      setIsRemoving(false)
    }
  }

  const handleDeleteOrganization = async () => {
    if (deleteConfirmation !== organizationName) {
      toast({
        title: 'Confirmation mismatch',
        description: 'Please type the organization name exactly as shown',
        variant: 'destructive'
      })
      return
    }

    setIsDeleting(true)

    try {
      // TODO: Implement actual API call to delete organization
      await new Promise(resolve => setTimeout(resolve, 1500))

      toast({
        title: 'Organization deleted',
        description: 'Your organization has been permanently deleted',
      })

      router.push('/projects')
    } catch (error) {
      toast({
        title: 'Failed to delete organization',
        description: 'Please try again later',
        variant: 'destructive'
      })
      setIsDeleting(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {organizationName}
            </p>
          </div>
        </div>

        {/* Team Management Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  Manage who has access to this organization
                </CardDescription>
              </div>
              <Badge variant="secondary">
                {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
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
                    <Label htmlFor="invite-email" className="text-xs">Email Address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-white dark:bg-gray-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="invite-role" className="text-xs">Role</Label>
                    <Select value={inviteRole} onValueChange={(value: 'admin' | 'member') => setInviteRole(value)}>
                      <SelectTrigger id="invite-role" className="w-[130px] bg-white dark:bg-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
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
                          Send Invite
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Team Members List */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Current Members
              </h3>
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {member.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {member.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-xs ${getRoleBadgeColor(member.role)}`}>
                            {member.role}
                          </Badge>
                          {member.status === 'pending' && (
                            <Badge variant="outline" className="text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {canManageMembers && member.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMemberToRemove(member.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role Permissions Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5" />
              Role Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <Badge className={getRoleBadgeColor('owner')}>Owner</Badge>
                <p className="text-gray-600 dark:text-gray-400">
                  Full access including organization deletion and owner transfer
                </p>
              </div>
              <div className="flex gap-3">
                <Badge className={getRoleBadgeColor('admin')}>Admin</Badge>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage members, agents, and organization settings
                </p>
              </div>
              <div className="flex gap-3">
                <Badge className={getRoleBadgeColor('member')}>Member</Badge>
                <p className="text-gray-600 dark:text-gray-400">
                  View and interact with agents and call logs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        {canDeleteOrg && (
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Deleting this organization will permanently remove all agents, call logs, 
                  configurations, and team member access. This action cannot be undone.
                </AlertDescription>
              </Alert>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full md:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Organization
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member? They will lose access to this organization immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Delete Organization
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the organization 
              and remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                All agents, call logs, and configurations will be permanently deleted.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-sm">
                Type <span className="font-mono font-semibold">{organizationName}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={organizationName}
                className="font-mono"
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