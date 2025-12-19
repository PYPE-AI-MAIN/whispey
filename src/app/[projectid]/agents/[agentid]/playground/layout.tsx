// Public layout for playground - no authentication required
// This layout bypasses the UserPermissionsProvider from parent layout
'use client'

import { usePathname } from 'next/navigation'

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This layout ensures playground is completely public
  // It bypasses all auth providers from parent layouts
  return <>{children}</>
}
