'use client'

import { useParams } from 'next/navigation'
import AdminPanel from '@/components/admin/AdminPanel'

export default function AdminPage() {
  const params = useParams()
  const projectId = params.projectid as string

  return <AdminPanel projectId={projectId} />
}

