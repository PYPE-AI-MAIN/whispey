'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import CallLogs from '@/components/calls/CallLogs'
import { useStudio } from '../_context'

const formatDateISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function StudioLogsPage() {
  const { agent, project, projectId, agentId, isLoading } = useStudio()
  const router = useRouter()

  const dateRange = useMemo(() => {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 7)
    return { from: formatDateISO(from), to: formatDateISO(to) }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <CallLogs
        project={project}
        agent={agent}
        dateRange={dateRange}
        onBack={() => router.push(`/${projectId}/agents/${agentId}/studio`)}
      />
    </div>
  )
}
