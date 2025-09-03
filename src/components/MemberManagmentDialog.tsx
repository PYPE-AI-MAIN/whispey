// components/MemberManagementDialog.tsx
'use client'
import React, { useState, useEffect } from 'react'
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
  const [role, setRole] = useState('member')
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [pendingMappings, setPendingMappings] = useState<PendingMapping[]>([])
  const [fetchingMembers, setFetchingMembers] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

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
      setMessage({ type: 'error', text: 'Please enter an email address' })
      return
    }

    setLoading(true)
    setMessage(null)

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

      setMessage({ 
        type: 'success', 
        text: data.type === 'direct_add' 
          ? 'User added to project successfully!'
          : 'Email added! User will be added when they sign up.'
      })
      
      setEmail('')
      setRole('member')
      
      // Refresh members list
      fetchMembers()
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Member must be logged in.'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800'
      case 'user': return 'bg-orange-100 text-orange-800'
      case 'admin': return 'bg-blue-100 text-blue-800'
      case 'member': return 'bg-green-100 text-green-800'
      case 'viewer': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
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
    setRole('member')
    setMessage(null)
    setMembers([])
    setPendingMappings([])
    onClose()
  }

  if (!project) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Members - {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Access Check */}
          {!canManageMembers && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  You need admin or owner access to manage project members.
                </p>
              </div>
            </div>
          )}

          {/* Add Member Form */}
          {canManageMembers && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Add New Member</h3>
              
              {message && (
                <div className={`p-3 rounded-lg ${
                  message.type === 'success' 
                    ? 'bg-green-50 text-green-800 border border-green-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="colleague@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="user">User</option>
                    <option value="viewer">Viewer (Read only)</option>
                    <option value="member">Member (Read & Write)</option>
                    <option value="admin">Admin (Read, Write & Delete)</option>
                  </select>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full"
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
              <h3 className="text-lg font-semibold">Current Members ({members.length})</h3>
              
              {fetchingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2 text-gray-600">Loading members...</span>
                </div>
              ) : members.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No members found</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.user.profile_image_url || undefined} />
                          <AvatarFallback>
                            {getUserInitials(member.user.first_name, member.user.last_name, member.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {member.user.first_name && member.user.last_name 
                              ? `${member.user.first_name} ${member.user.last_name}`
                              : member.user.email
                            }
                          </p>
                          <p className="text-sm text-gray-600">{member.user.email}</p>
                          <p className="text-xs text-gray-500">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role}
                        </Badge>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending Email Mappings */}
              {pendingMappings.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-700 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pending Invitations ({pendingMappings.length})
                  </h4>
                  {pendingMappings.map((mapping) => (
                    <div key={mapping.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-yellow-200 rounded-full flex items-center justify-center">
                          <Mail className="h-5 w-5 text-yellow-700" />
                        </div>
                        <div>
                          <p className="font-medium">{mapping.email}</p>
                          <p className="text-xs text-gray-500">
                            Invited {new Date(mapping.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadgeColor(mapping.role)}>
                          {mapping.role}
                        </Badge>
                        <Clock className="h-4 w-4 text-yellow-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Close Button */}
          <div className="pt-4 border-t">
            <Button onClick={handleClose} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MemberManagementDialog