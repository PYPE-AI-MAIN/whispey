'use client'

import { useQuery } from '@tanstack/react-query'
import type { MemberVisibility } from '@/types/visibility'
import { DEFAULT_MEMBER_VISIBILITY } from '@/types/visibility'

interface ProjectMeResponse {
  role: string
  permissions: Record<string, unknown>
  /** Resolved from DB permissions.visibility; drives what the UI shows. */
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
 * Role and visibility for the current project. Source: API reads
 * pype_voice_email_project_mapping.permissions.visibility (single column).
 * Update permissions in Supabase → frontend reflects on next fetch or when
 * the user refocuses the window (refetchOnWindowFocus).
 */
export function useMemberVisibility(projectId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['project-me', projectId],
    queryFn: () => fetchProjectMe(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,   // 5 min — matches global default
    gcTime: 15 * 60 * 1000,     // keep in cache 15 min after last subscriber unmounts
    refetchOnWindowFocus: false, // navigation back ≠ stale permissions
    refetchOnMount: false,       // React Query serves from cache if fresh
  })

  const role = data?.role ?? null
  const visibility: MemberVisibility | null = data?.visibility ?? null

  return {
    role,
    visibility,
    isOwnerOrAdmin: role === 'owner' || role === 'admin',
    isViewer: role === 'viewer',
    isLoading,
    error,
  }
}
