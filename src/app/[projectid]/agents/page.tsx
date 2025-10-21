// src/app/[projectid]/agents/page.tsx
'use client'
import { useParams } from 'next/navigation'
import AgentSelection from '@/components/agents/AgentSelect/AgentSelection'

export default function ProjectAgentsPage() {
  const params = useParams()
  const projectId = params.projectid as string
  const assistantId = params.assistantid as string

  return (
    <>
      <AgentSelection />
    </>
  )
}