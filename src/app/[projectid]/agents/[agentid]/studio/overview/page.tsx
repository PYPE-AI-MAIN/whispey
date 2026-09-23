'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import AnalyticsCanvas from '@/components/analytics/AnalyticsCanvas'
import { useStudio } from '../_context'

const formatDateISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function StudioOverviewPage() {
  const { agent, project, isLoading } = useStudio()

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
    <div className="h-full">
      <AnalyticsCanvas project={project} agent={agent} dateRange={dateRange} isActive />
    </div>
  )
}
