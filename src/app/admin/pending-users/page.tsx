'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

type RequestStatus = 'pending' | 'active' | 'declined'

interface PendingUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  profile_image_url: string | null
  created_at: string
  approval_status: RequestStatus
}

const STATUS_PILL: Record<RequestStatus, string> = {
  pending: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10 border-amber-300 dark:border-amber-400/20',
  active: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-400/10 border-emerald-300 dark:border-emerald-400/20',
  declined: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-400/10 border-red-300 dark:border-red-400/20',
}

export default function PendingUsersAdminPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Platform-admin gate — same check the old project-scoped Requests tab
  // used, just no longer tied to any specific project.
  const { data: meStatus, isLoading: meStatusLoading } = useQuery<{ isPlatformAdmin: boolean }>({
    queryKey: ['me-status-for-pending-users-admin'],
    queryFn: async () => {
      const res = await fetch('/api/me/status')
      if (!res.ok) return { isPlatformAdmin: false }
      return res.json()
    },
    staleTime: 60_000,
  })
  const isPlatformAdmin = meStatus?.isPlatformAdmin ?? false

  const { data, isLoading } = useQuery<{ users: PendingUser[] }>({
    queryKey: ['pending-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/pending-users')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: isPlatformAdmin,
    staleTime: 30_000,
  })

  const decide = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'decline' }) => {
      const res = await fetch(`/api/admin/pending-users/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'Failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] })
    },
  })

  if (meStatusLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent" />
      </div>
    )
  }

  if (!isPlatformAdmin) {
    router.replace('/projects')
    return null
  }

  const users = data?.users ?? []

  let tableContent: React.ReactNode
  if (isLoading) {
    tableContent = <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  } else if (users.length === 0) {
    tableContent = (
      <div className="py-16 flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
        <Users className="h-6 w-6" />
        <span className="text-sm">No signup requests yet</span>
      </div>
    )
  } else {
    tableContent = (
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Requested</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {users.map(u => {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email.split('@')[0]
            const requested = new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            return (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3">
                  <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{name}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{u.email}</p>
                </td>
                <td className="px-3 py-3 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{requested}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${STATUS_PILL[u.approval_status]}`}>
                    {u.approval_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.approval_status === 'pending' ? (
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: u.id, action: 'approve' })}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: u.id, action: 'decline' })}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/projects')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pending Signup Requests</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-5xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {tableContent}
        </div>
      </div>
    </div>
  )
}
