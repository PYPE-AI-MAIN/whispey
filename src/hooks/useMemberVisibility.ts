'use client'

import { useQuery } from '@tanstack/react-query'
import type { MemberVisibility } from '@/types/visibility'
import { DEFAULT_MEMBER_VISIBILITY, mergeWithDefaults } from '@/types/visibility'

interface ProjectMeResponse {
  role: string
  permissions: Record<string, unknown>
  visibility: MemberVisibility
}

async function fetchProjectMe(projectId: string): Promise<ProjectMeResponse> {
  const res = await fetch(`/api/projects/${projectId}/me`)
  if (!res.ok) {
    if (res.status === 403) throw new Error('Not a member')
    throw new Error('Failed to fetch')
  }
  return res.json()
}

/**
 * Returns current user's role and visibility for the project.
 * Owner/Admin: returns full visibility (all true). User/Viewer: returns their saved visibility or defaults.
 */
export function useMemberVisibility(projectId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['project-me', projectId],
    queryFn: () => fetchProjectMe(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 1000,
  })

  const role = data?.role ?? null
  const visibility: MemberVisibility = data?.visibility
    ? mergeWithDefaults(data.visibility)
    : DEFAULT_MEMBER_VISIBILITY

  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const effectiveVisibility: MemberVisibility = isOwnerOrAdmin
    ? DEFAULT_MEMBER_VISIBILITY
    : visibility

  return {
    role,
    visibility: effectiveVisibility,
    isOwnerOrAdmin,
    isLoading,
    error,
  }
}
