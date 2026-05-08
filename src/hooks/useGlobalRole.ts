'use client'

import { useQuery } from '@tanstack/react-query'

type GlobalRole = 'superadmin' | 'prompter' | 'user'

export function useGlobalRole() {
  const { data, isLoading } = useQuery<{ globalRole: GlobalRole }>({
    queryKey: ['global-role'],
    queryFn: async () => {
      const res = await fetch('/api/me/global-role')
      if (!res.ok) return { globalRole: 'user' as GlobalRole }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const globalRole = data?.globalRole ?? 'user'
  return {
    globalRole,
    isSuperAdmin: globalRole === 'superadmin',
    isPrompter: globalRole === 'prompter',
    canAccessPromptForge: globalRole === 'superadmin' || globalRole === 'prompter',
    isLoading,
  }
}
