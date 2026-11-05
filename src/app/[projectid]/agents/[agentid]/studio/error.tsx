'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

// Catches anything that throws while rendering Studio, so a client sees a calm
// message with a way forward instead of a stack trace or a blank page.
export default function StudioError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error('[Studio] render error:', error)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium text-foreground">Something went wrong</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        Try again, or refresh the page if it keeps happening.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={reset}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
        <button
          onClick={() => globalThis.location.reload()}
          className="cursor-pointer text-xs text-muted-foreground underline-offset-2 transition hover:text-muted-foreground hover:underline"
        >
          Refresh page
        </button>
      </div>
    </div>
  )
}
