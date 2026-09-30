// src/app/[projectid]/settings/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import OrganizationSettings from "@/components/projects/OrganizationSettings"
import { Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const { projectid: projectId } = useParams()

  // Fetch all projects using React Query
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      return response.json()
    },
    staleTime: 30000, // Cache for 30 seconds
  })

  // Find the current organization
  const organization = projects?.find((org: any) => org.id === projectId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">Failed to load organization</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-2">Organization not found</p>
          <Link
            href="/projects"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to organizations
          </Link>
        </div>
      </div>
    )
  }

  // h-full, not h-screen: the shared SidebarWrapper shell already sizes
  // <main> to exactly the viewport (flex-1 in a h-screen row) and owns
  // overflow-auto as the one scroll container. Nesting another h-screen box
  // inside it just adds a second, redundant full-viewport box — if this
  // page's total content is ever taller than that, it's main's overflow-auto
  // that ends up scrolling the whole page, not the table only. overflow-hidden
  // here instead makes sure main never has to: everything that doesn't fit is
  // the Team Members table's job to absorb (see its own flex-1/overflow-y-auto).
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-6 p-4 sm:p-6 overflow-hidden">
        <OrganizationSettings
          organizationName={organization.name}
          organizationId={organization.id}
        />
      </div>
    </div>
  )
}