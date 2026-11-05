'use client'

import { useQuery } from '@tanstack/react-query'

/** Shown only for projects whose call data was routed away from Pype: older calls are not copied over. */
export function DataLocationBanner({ projectId }: { projectId: string }) {
  const { data } = useQuery<{ since: string | null }>({
    queryKey: ['data-location', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/data-location`)
      return res.ok ? res.json() : { since: null }
    },
    staleTime: 5 * 60_000,
  })
  if (!data?.since) return null
  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-md">
      Data before {new Date(data.since).toLocaleDateString()} lives elsewhere and is not shown here.
    </div>
  )
}
