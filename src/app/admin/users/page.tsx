'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, UserCog, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import toast from 'react-hot-toast'

interface User {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  roles: {
    type: 'USER' | 'BETA' | 'SUPERADMIN'
    level: number
  }
  profile_image_url: string | null
  created_at: string
  project_count: number
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user: clerkUser, isLoaded } = useUser()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [newRole, setNewRole] = useState<'USER' | 'BETA'>('USER')
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAccess = async () => {
      if (!isLoaded) return
      
      if (!clerkUser?.id) {
        router.push('/unauthorized')
        return
      }

      try {
        const response = await fetch('/api/user/users')
        
        if (!response.ok) {
          setIsAuthorized(false)
          router.push('/unauthorized')
          return
        }
        
        const result = await response.json()
        
        if (result.data?.roles?.type === 'SUPERADMIN') {
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (roleFilter !== 'all') params.append('role', roleFilter)

      const response = await fetch(`/api/admin/users?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch users')
      return response.json()
    },
    enabled: isAuthorized === true,
    staleTime: 30000,
    retry: false
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'USER' | 'BETA' }) => {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: userId,
          new_role: role
        })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update user')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User role updated successfully')
      setShowConfirmDialog(false)
      setSelectedUser(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const handleRoleChange = (user: User, role: 'USER' | 'BETA') => {
    setSelectedUser(user)
    setNewRole(role)
    setShowConfirmDialog(true)
  }

  const confirmRoleChange = () => {
    if (selectedUser) {
      updateRoleMutation.mutate({
        userId: selectedUser.clerk_id,
        role: newRole
      })
    }
  }

  const usersByRole = data?.users?.reduce((acc: Record<string, User[]>, user: User) => {
    const role = user.roles.type
    if (!acc[role]) acc[role] = []
    acc[role].push(user)
    return acc
  }, {}) || {}

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPERADMIN': 
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
      case 'BETA': 
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      default: 
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          User Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage user roles and permissions across the platform
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="USER">USER</SelectItem>
            <SelectItem value="BETA">BETA</SelectItem>
            <SelectItem value="SUPERADMIN">SUPERADMIN</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          Error loading users. Please try again.
        </div>
      )}

      {/* Users List */}
      {!isLoading && !error && (
        <div className="space-y-6">
          {['SUPERADMIN', 'BETA', 'USER'].map((role) => {
            const users = usersByRole[role] || []
            if (users.length === 0) return null

            return (
              <section key={role}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {role} ROLE
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({users.length})
                  </span>
                </div>

                <div className="space-y-3">
                  {users.map((user: any) => (
                    <article
                      key={user.clerk_id}
                      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {user.profile_image_url ? (
                            <img
                              src={user.profile_image_url}
                              alt={`${user.email} profile`}
                              className="w-10 h-10 rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div 
                              className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0"
                              aria-label="Default user avatar"
                            >
                              <UserCog className="w-5 h-5 text-gray-500" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {user.first_name || user.last_name
                                  ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                  : user.email}
                              </p>
                              <span 
                                className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${getRoleBadgeColor(role)}`}
                                aria-label={`User role: ${role}`}
                              >
                                {role}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {user.email} • {user.project_count} project{user.project_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        {role !== 'SUPERADMIN' && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {role === 'USER' && (
                              <Button
                                onClick={() => handleRoleChange(user, 'BETA')}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                aria-label={`Upgrade ${user.email} to BETA`}
                              >
                                Upgrade to BETA
                              </Button>
                            )}
                            {role === 'BETA' && (
                              <Button
                                onClick={() => handleRoleChange(user, 'USER')}
                                size="sm"
                                variant="outline"
                                aria-label={`Downgrade ${user.email} to USER`}
                              >
                                Downgrade to USER
                              </Button>
                            )}
                          </div>
                        )}

                        {role === 'SUPERADMIN' && (
                          <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 flex-shrink-0">
                            <Shield className="w-4 h-4" aria-hidden="true" />
                            <span className="text-sm font-medium">Platform Admin</span>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}

          {Object.keys(usersByRole).length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No users found matching your criteria
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to change {selectedUser?.email}'s role to {newRole}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={updateRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRoleChange}
              disabled={updateRoleMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateRoleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}