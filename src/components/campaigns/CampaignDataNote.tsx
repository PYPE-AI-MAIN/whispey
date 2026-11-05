'use client'

import { useCampaignLocation } from '@/hooks/useCampaignExtras'

/** Shown only when the project's campaign contacts are stored in the customer's environment. */
export function CampaignDataNote({ projectId }: { projectId: string }) {
  const { data } = useCampaignLocation(projectId)
  if (data !== 'customer') return null
  return (
    <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground" role="note">
      Contacts for this project are stored in the customer&apos;s environment. Older campaigns may still live in Pype.
    </p>
  )
}
