/**
 * The backstop — the agent page's own boundary.
 *
 * The chart cards each have one, so a single broken chart stays a broken chart.
 * This catches everything outside them: the header, the filter bar, the panel,
 * a hook that throws on a shape nobody anticipated. Without it React unmounts to
 * the root and the person is looking at a white screen with no way back.
 */
'use client'
import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AgentPageError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  React.useEffect(() => {
    console.error('[agent page]', error)
  }, [error])

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="h-5 w-5 text-gray-400" />
      <p className="text-sm text-gray-600 dark:text-gray-300">Something on this page stopped working.</p>
      <p className="max-w-md text-xs text-gray-400">
        Nothing was lost — your dashboard is saved. Try again, and if it keeps happening the reference is{' '}
        <span className="font-mono">{error.digest ?? 'not recorded'}</span>.
      </p>
      <Button size="sm" variant="outline" onClick={reset}>
        <RotateCcw className="mr-2 h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  )
}
