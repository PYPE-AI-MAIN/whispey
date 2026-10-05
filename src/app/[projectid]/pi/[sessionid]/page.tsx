'use client'

// An existing session — your own (resumable) or, for an owner/admin, someone
// else's (read-only — this is the audit path: see exactly what a teammate
// asked Pi, not just that they asked something).

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PiChatView, { type Message } from '@/components/pi/PiChatView'
import PiLoading from '@/components/pi/PiLoading'

interface SessionDetail {
  id: string
  user_id: string
  user_email: string
  messages: Omit<Message, 'id' | 'isFinal'>[]
}

async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/pi/sessions/${id}`)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? 'Could not load this chat')
  return data
}

export default function PiSessionPage() {
  const params = useParams()
  const projectId = params.projectid as string
  const sessionId = params.sessionid as string
  const { user } = useUser()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['pi-session', sessionId],
    queryFn: () => fetchSession(sessionId),
    // this chat can change from another tab, device, or window focus — the
    // global 5-minute staleTime AND refetchOnWindowFocus:false (QueryProvider.tsx)
    // otherwise serve a stale cached fetch whenever you switch back to this
    // browser tab or navigate back within that window, which is exactly the
    // "latest messages gone until hard refresh" symptom. Overridden here only;
    // the global defaults stay as-is for every other query in the app.
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const initialMessages = useMemo<Message[]>(
    () => (data?.messages ?? []).map((m, i) => ({ ...m, id: `${sessionId}-${i}`, isFinal: true })),
    [data?.messages, sessionId],
  )

  if (isLoading && !data) return <PiLoading />
  if (error || !data) {
    return <div className="h-full flex items-center justify-center text-sm text-red-500">{(error as Error)?.message ?? 'Chat not found'}</div>
  }

  const isOwner = data.user_id === user?.id

  return (
    <PiChatView
      key={sessionId}
      projectId={projectId}
      sessionId={sessionId}
      initialMessages={initialMessages}
      readOnly={!isOwner}
      readOnlyLabel={!isOwner ? `Viewing ${data.user_email}'s conversation (read-only)` : undefined}
      onTurnComplete={() => queryClient.invalidateQueries({ queryKey: ['pi-sessions', projectId] })}
    />
  )
}
