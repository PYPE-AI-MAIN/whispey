// app/[projectid]/layout.tsx
'use client'

import { UserPermissionsProvider } from '@/contexts/UserPermissionsContext'
import { useParams } from 'next/navigation'

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const projectId = params.projectid as string

  return (
    <UserPermissionsProvider projectId={projectId}>
      {children}
    </UserPermissionsProvider>
  )
}