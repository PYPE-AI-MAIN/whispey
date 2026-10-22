'use client'

// The "new chat" view — no session yet. PiChatView creates one lazily on the
// first message. The URL is updated via the raw History API, NOT next/navigation's
// router — a router.replace() would remount this page into the [sessionid]
// route mid-stream and silently drop the in-progress response; the browser
// address bar still needs to reflect the session for refresh/bookmarking, and
// a plain history update does that without touching the live component tree.

import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import PiChatView from '@/components/pi/PiChatView'

export default function PiNewChatPage() {
  const params = useParams()
  const projectId = params.projectid as string
  const queryClient = useQueryClient()

  return (
    <PiChatView
      projectId={projectId}
      onSessionCreated={(sessionId) => {
        try { localStorage.setItem(`pi-last:${projectId}`, sessionId) } catch {}
        globalThis.history.replaceState(null, '', `/${projectId}/pi/${sessionId}`)
        queryClient.invalidateQueries({ queryKey: ['pi-sessions', projectId] })
      }}
      onTurnComplete={() => queryClient.invalidateQueries({ queryKey: ['pi-sessions', projectId] })}
    />
  )
}
