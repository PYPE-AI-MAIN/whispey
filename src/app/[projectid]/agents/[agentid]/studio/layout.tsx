'use client'

import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StudioProvider, useStudio } from './_context'

function StudioShell({ children }: { children: ReactNode }) {
  const { agent, isLoading } = useStudio()

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-3.5 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-900 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
            {agent?.name?.[0]?.toUpperCase() ?? '·'}
          </div>
          <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {isLoading ? 'Loading agent…' : (agent?.name ?? 'Agent')}
          </h1>
          <Badge
            variant="outline"
            className="border-gray-300 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400"
          >
            Beta
          </Badge>
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  )
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <StudioProvider>
      <StudioShell>{children}</StudioShell>
    </StudioProvider>
  )
}
