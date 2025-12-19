// app/[projectid]/layout.tsx
'use client'

import { UserPermissionsProvider } from '@/contexts/UserPermissionsContext'
import { useParams, usePathname } from 'next/navigation'

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const projectId = params.projectid as string
  const isPlayground = pathname?.includes('/playground')

  // Skip UserPermissionsProvider for playground routes (they're public)
  if (isPlayground) {
    return <>{children}</>
  }

  return (
    <UserPermissionsProvider projectId={projectId}>
      {children}
    </UserPermissionsProvider>
  )
}