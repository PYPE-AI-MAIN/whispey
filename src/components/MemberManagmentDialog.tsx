// components/MemberManagementDialog.tsx
'use client'
import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  UserPlus, 
  Mail, 
  Loader2, 
  Users,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface Project {
  id: string
  name: string
  user_role: string
}

interface Member {
  id: number
  clerk_id: string
  role: string
  permissions: Record<string, any>
  joined_at: string
  user: {
    email: string
    first_name: string | null
    last_name: string | null
    profile_image_url: string | null
  }
}

interface PendingMapping {
  id: number
  email: string
  role: string
  permissions: Record<string, any>
  created_at: string
}

interface MemberManagementDialogProps {
  isOpen: boolean
  onClose: any
  project: Project | null
}

const MemberManagementDialog: React.FC<MemberManagementDialogProps> = ({
  isOpen,
  onClose,
  project
}) => {

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer')
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [pendingMappings, setPendingMappings] = useState<PendingMapping[]>([])
  const [fetchingMembers, setFetchingMembers] = useState(false)

  // Check if current user can manage members
  const canManageMembers = project?.user_role === 'owner' || project?.user_role === 'admin'

  useEffect(() => {
    if (isOpen && project && canManageMembers) {
      fetchMembers()
    }
  }, [isOpen, project, canManageMembers])

  const fetchMembers = async () => {
    if (!project) return
    
    setFetchingMembers(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/members`)

      if (response.ok) {
        const data = await response.json()

        console.log("Fetched members data:", data)
        setMembers(data.members || [])
        setPendingMappings(data.pending_mappings || [])
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setFetchingMembers(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!project || !email.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          role: role
        }),
      })

      const data = await response.json()

      console.log("user_data",data)

      if (!response.ok) {
        throw new Error(data.error || 'Member must be logged in.')
      }

      if (data.inviteSent === false) {
        toast.error(
          data.type === 'direct_add'
            ? 'User added to organization, but the invite email could not be sent. Check your email configuration.'
            : 'User added to pending list, but the invite email could not be sent. Check your email configuration.',
          { duration: 5000 }
        )
      } else {
        toast.success(
          data.type === 'direct_add'
            ? 'User added to organization successfully! An invite email has been sent.'
            : 'Invite sent! User will be added when they sign up.'
        )
      }
      
      setEmail('')
      setRole('viewer')
      
      // Refresh members list
      fetchMembers()
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Member must be logged in.'
      toast.error(errorMessage, { duration: 5000 })
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      case 'admin': return 'bg-primary/15 text-primary'
      case 'member':
      case 'user':
      case 'viewer':
        return 'bg-muted text-foreground'
      default: return 'bg-muted text-foreground'
    }
  }

  const getUserInitials = (firstName: string | null, lastName: string | null, email: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase()
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  const handleClose = () => {
    setEmail('')
    setRole('viewer')
    setMembers([])
    setPendingMappings([])
    onClose()
  }

  if (!project) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5" />
            Manage Members - {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Access Check */}
          {!canManageMembers && (
            <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                <p className="text-sm text-warning">
                  You need admin or owner access to manage project members.
                </p>
              </div>
            </div>
          )}

          {/* Add Member Form */}
          {canManageMembers && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Add New Member</h3>
              
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label htmlFor="member-email" className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <input id="member-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="colleague@example.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="member-role" className="block text-sm font-medium text-foreground mb-2">
                    Role
                  </label>
                  <select id="member-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'viewer')}
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="viewer">Viewer (Read only)</option>
                    <option value="admin">Admin (Read, Write & Delete)</option>
                  </select>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  {loading ? 'Adding...' : 'Add Member'}
                </Button>
              </form>
            </div>
          )}

          {/* Members List */}
          {canManageMembers && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Current Members ({members.length})</h3>
              
              {fetchingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading members...</span>
                </div>
              ) : members.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No members found</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.user.profile_image_url || undefined} />
                          <AvatarFallback className="bg-primary/15 text-primary">
                            {getUserInitials(member.user.first_name, member.user.last_name, member.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">
                            {member.user.first_name && member.user.last_name 
                              ? `${member.user.first_name} ${member.user.last_name}`
                              : member.user.email
                            }
                          </p>
                          <p className="text-sm text-muted-foreground">{member.user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role}
                        </Badge>
                        <CheckCircle className="h-4 w-4 text-success" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending Email Mappings */}
              {pendingMappings.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pending Invitations ({pendingMappings.length})
                  </h4>
                  {pendingMappings.map((mapping) => (
                    <div key={mapping.id} className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/30">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-warning/20 rounded-full flex items-center justify-center">
                          <Mail className="h-5 w-5 text-warning" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{mapping.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Invited {new Date(mapping.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadgeColor(mapping.role)}>
                          {mapping.role}
                        </Badge>
                        <Clock className="h-4 w-4 text-warning" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Close Button */}
          <div className="pt-4 border-t border-border">
            <Button onClick={handleClose} variant="outline" className="w-full border-border text-foreground hover:bg-muted/50">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MemberManagementDialog