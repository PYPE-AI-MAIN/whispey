import { notFound } from 'next/navigation'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'

/** Server-side guard: the whole subtree is for platform admins (PYPE_ADMINS) only. */
export default async function DataDestinationsLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) notFound()
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
}
