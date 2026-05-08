'use client'

import { Suspense } from 'react'
import { SessionsGuard } from '@/components/prompt-forge/SessionsGuard'

export default function PromptForgeRoute() {
  return (
    <Suspense fallback={null}>
      <SessionsGuard />
    </Suspense>
  )
}