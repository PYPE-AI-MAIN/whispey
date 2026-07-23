'use client'

import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { useGlobalRole } from '@/hooks/useGlobalRole'

/**
 * Whether the current user can view a call's agent Config tab —
 * project owner/admin, or global superadmin.
 */
export function useConfigTabAccess(projectId: string | undefined) {
  const { isOwnerOrAdmin } = useMemberVisibility(projectId)
  const { isSuperAdmin } = useGlobalRole()
  return isOwnerOrAdmin || isSuperAdmin
}
