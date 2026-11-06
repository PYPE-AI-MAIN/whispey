'use client'

import { useCampaignStorage } from '@/hooks/useCampaignExtras'

/** Shown only when the project's campaign contacts are stored in the customer's environment. */
export function CampaignDataNote({ projectId }: { projectId: string }) {
  const { data } = useCampaignStorage(projectId)
  if (data?.location !== 'customer') return null
  return (
    <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground" role="note">
      Stored in customer cloud{data.destination ? `: ${data.destination}` : ''}. Contacts for new campaigns live in the customer&apos;s environment; older campaigns may still live in Pype.
    </p>
  )
}
