import { useEffect, useState } from 'react'
import { getUserProjectRole } from '@/services/getUserRole'

/**
 * The caller's role on a project — split out of useCallLogsData so pages that
 * need a role/viewer check (e.g. to gate Flag) don't have to pull in the
 * whole call-logs-table hook just for this one value.
 */
export function useProjectRole(projectId: string | undefined) {
  const [role, setRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    if (!projectId) {
      setRole('user')
      setRoleLoading(false)
      return
    }
    let cancelled = false
    setRoleLoading(true)
    getUserProjectRole('', projectId)
      .then((r) => { if (!cancelled) setRole(r.role) })
      .catch(() => { if (!cancelled) setRole('user') })
      .finally(() => { if (!cancelled) setRoleLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  return { role, roleLoading }
}
