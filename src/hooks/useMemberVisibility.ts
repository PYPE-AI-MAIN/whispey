'use client'

import { useQuery } from '@tanstack/react-query'
import type { MemberVisibility } from '@/types/visibility'
import { DEFAULT_MEMBER_VISIBILITY, VIEWER_RESTRICTED_VISIBILITY } from '@/types/visibility'

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
 * Owner/Admin: returns full visibility (all true). Viewer: returns restricted visibility.
 */
export function useMemberVisibility(projectId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['project-me', projectId],
    queryFn: () => fetchProjectMe(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 1000,
  })

  const role = data?.role ?? null

  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const isViewer = role === 'viewer'

  let effectiveVisibility: MemberVisibility
  if (isOwnerOrAdmin) {
    effectiveVisibility = DEFAULT_MEMBER_VISIBILITY
  } else if (isViewer) {
    // Viewers always get the fixed restricted visibility (no frontend overrides)
    effectiveVisibility = VIEWER_RESTRICTED_VISIBILITY
  } else {
    effectiveVisibility = DEFAULT_MEMBER_VISIBILITY
  }

  return {
    role,
    visibility: effectiveVisibility,
    isOwnerOrAdmin,
    isLoading,
    error,
  }
}
