'use client'

import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { useMobile } from '@/hooks/use-mobile'
import { canViewApiKeys, getUserProjectRole } from '@/services/getUserRole'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useFeatureAccess } from '@/app/providers/FeatureAccessProvider'

interface SidebarWrapperProps {
  children: ReactNode
}

const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'

// Reserved paths that are NOT project IDs
const RESERVED_PATHS = ['sign', 'docs', 'projects', 'onboarding', 'privacy-policy', 'terms-of-service']

interface RoutePattern {
  pattern: string
  exact?: boolean
}

interface SidebarRoute {
  patterns: RoutePattern[]
  getSidebarConfig: (params: RouteParams, context: SidebarContext) => SidebarConfig | null
  priority?: number
}

interface RouteParams {
  [key: string]: string
}

interface SidebarContext {
  isEnhancedProject: boolean
  userCanViewApiKeys: boolean
  projectId?: string
  agentType?: string
  canAccessPhoneCalls: boolean
  canAccessPhoneSettings: boolean
}

interface NavigationItem {
  id: string
  name: string
  icon: string
  path: string
  group?: string
  external?: boolean
}

export interface SidebarConfig {
  type: string
  context: Record<string, any>
  navigation: NavigationItem[]
  showBackButton: boolean
  backPath?: string
  backLabel?: string
}

const matchRoute = (pathname: string, pattern: string): RouteParams | null => {
  if (pattern.endsWith('*')) {
    const basePattern = pattern.slice(0, -1)
    if (!pathname.startsWith(basePattern)) {
      return null
    }
    
    const paramNames: string[] = []
    const regexPattern = basePattern
      .replace(/:[^/]+/g, (match) => {
        paramNames.push(match.slice(1))
        return '([^/]+)'
      })

    const regex = new RegExp(`^${regexPattern}`)
    const match = pathname.match(regex)

    if (!match) return null

    const params: RouteParams = {}
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1]
    })

    return params
  }

  const paramNames: string[] = []
  const regexPattern = pattern
    .replace(/:[^/]+/g, (match) => {
      paramNames.push(match.slice(1))
      return '([^/]+)'
    })

  const regex = new RegExp(`^${regexPattern}$`)
  const match = pathname.match(regex)

  if (!match) return null

  const params: RouteParams = {}
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1]
  })

  return params
}

// sidebarRoutes array
const sidebarRoutes: SidebarRoute[] = [
  // Hide sidebar for auth and docs pages ONLY
  {
    patterns: [
      { pattern: '/sign*' },
      { pattern: '/docs*' }
    ],
    getSidebarConfig: () => null,
    priority: 100
  },

  // Onboarding route - show sidebar but minimal nav
  {
    patterns: [
      { pattern: '/onboarding' }
    ],
    getSidebarConfig: () => ({
      type: 'onboarding',
      context: {},
      navigation: [
        { 
          id: 'docs', 
          name: 'Documentation', 
          icon: 'FileText', 
          path: '/docs', 
          external: true, 
          group: 'resources' 
        }
      ],
      showBackButton: false
    }),
    priority: 96
  },

  // Project-level agents routes (UPDATED - now includes campaigns)
  {
    patterns: [
      { pattern: '/:projectId/agents' },
      { pattern: '/:projectId/agents/api-keys' },
      { pattern: '/:projectId/agents/sip-management' },
      { pattern: '/:projectId/campaigns' },
      { pattern: '/:projectId/settings' },
      { pattern: '/:projectId/campaigns/:campaignId' },
      { pattern: '/:projectId/campaigns/create' }
    ],
    getSidebarConfig: (params, context) => {
      const { projectId } = params
      const { userCanViewApiKeys, canAccessPhoneSettings } = context

      const baseNavigation = [
        {
          id: 'agent-list', 
          name: 'Agent List', 
          icon: 'Activity', 
          path: `/${projectId}/agents`, 
          group: 'Agents' 
        }
      ]

    
      const campaignsItems = []
      if (canAccessPhoneSettings) {
        campaignsItems.push({
          id: 'campaigns',
          name: 'Campaigns',
          icon: 'Calendar',
          path: `/${projectId}/campaigns`,
          group: 'Batch Calls'
        })
      }

      const configurationItems = []
      
      if (canAccessPhoneSettings) {
        configurationItems.push({
          id: 'sip-management',
          name: 'Phone Settings',
          icon: 'Phone',
          path: `/${projectId}/agents/sip-management`,
          group: 'configuration'
        })
      }

      const projectSettingItems = []

      if (userCanViewApiKeys) {
        projectSettingItems.push({
          id: 'api-keys',
          name: 'Project API Key',
          icon: 'Key',
          path: `/${projectId}/agents/api-keys`,
          group: 'Project Settings'
        })
      }
      
      projectSettingItems.push({
        id: 'settings',
        name: 'Settings',
        icon: 'Settings',
        path: `/${projectId}/settings`,
        group: 'Project Settings'
      })

      return {
        type: 'project-agents',
        context: { projectId },
        navigation: [
          ...baseNavigation, 
          ...campaignsItems,
          ...configurationItems, 
          ...projectSettingItems
        ],
        showBackButton: false,
        backPath: '/projects',
        backLabel: 'Back to Organisations'
      }
    },
    priority: 95
  },

  // Individual agent routes
  {
    patterns: [
      { pattern: '/:projectId/agents/:agentId' },
      { pattern: '/:projectId/agents/:agentId/config' },
      { pattern: '/:projectId/agents/:agentId/observability' },
      { pattern: '/:projectId/agents/:agentId/phone-call-config' },
      { pattern: '/:projectId/agents/:agentId/monitoring' },
    ],
    getSidebarConfig: (params, context) => {
      const { projectId, agentId } = params
      const { isEnhancedProject, agentType, canAccessPhoneCalls } = context

      const reservedPaths = ['api-keys', 'settings', 'config', 'observability', 'sip-management'];
      if (reservedPaths.includes(agentId)) {
        return null;
      }

      const baseNavigation = [
        { 
          id: 'overview', 
          name: 'Overview', 
          icon: 'Activity', 
          path: `/${projectId}/agents/${agentId}?tab=overview`,
          group: 'LOGS' 
        },
        { 
          id: 'logs', 
          name: 'Call Logs', 
          icon: 'List', 
          path: `/${projectId}/agents/${agentId}?tab=logs`,
          group: 'LOGS' 
        },
        { 
          id: 'monitoring', 
          name: 'Error Monitoring', 
          icon: 'AlertCircle', 
          path: `/${projectId}/agents/${agentId}/monitoring`,
          group: 'LOGS' 
        }
      ]

      const configItems = []
      if (agentType === 'pype_agent') {
        configItems.push({ 
          id: 'agent-config', 
          name: 'Agent Config', 
          icon: 'Settings', 
          path: `/${projectId}/agents/${agentId}/config`, 
          group: 'configuration' 
        })
      }

      const callItems = []
      if (agentType === 'pype_agent' && canAccessPhoneCalls) {
        callItems.push({
          id: 'phone-call',
          name: 'Phone Calls',
          icon: 'Phone',
          path: `/${projectId}/agents/${agentId}/phone-call-config`,
          group: 'call configuration'
        })
      }

      const enhancedItems = []
      if (isEnhancedProject) {
        enhancedItems.push({ 
          id: 'campaign-logs', 
          name: 'Campaign Logs', 
          icon: 'BarChart3', 
          path: `/${projectId}/agents/${agentId}?tab=campaign-logs`, 
          group: 'Batch Calls' 
        })
      }

      const navigation = [
        ...baseNavigation,
        ...configItems,
        ...callItems,
        ...enhancedItems
      ]

      return {
        type: 'agent-detail',
        context: { agentId, projectId },
        navigation,
        showBackButton: false,
      }
    },
    priority: 90
  },

  // Main Organisations/projects route
  {
    patterns: [
      { pattern: '/', exact: true },
      { pattern: '/projects', exact: true }
    ],
    getSidebarConfig: () => ({
      type: 'organisations',
      context: {},
      navigation: [
        { 
          id: 'docs', 
          name: 'Documentation', 
          icon: 'FileText', 
          path: '/docs', 
          external: true, 
          group: 'resources' 
        }
      ],
      showBackButton: false
    }),
    priority: 85
  },

  // Fallback for any other routes
  {
    patterns: [
      { pattern: '*' }
    ],
    getSidebarConfig: () => ({
      type: 'organisations',
      context: {},
      navigation: [
        { 
          id: 'organisations', 
          name: 'Organisations', 
          icon: 'Home', 
          path: '/projects' 
        },
        { 
          id: 'docs', 
          name: 'Documentation', 
          icon: 'FileText', 
          path: '/docs', 
          external: true, 
          group: 'resources' 
        }
      ],
      showBackButton: false
    }),
    priority: 1
  }
]

const getSidebarConfig = (
  pathname: string, 
  context: SidebarContext
): SidebarConfig | null => {
  const sortedRoutes = [...sidebarRoutes].sort((a, b) => (b.priority || 0) - (a.priority || 0))

  for (const route of sortedRoutes) {
    for (const { pattern, exact } of route.patterns) {
      let params: RouteParams | null = null

      if (exact) {
        if (pathname === pattern) {
          params = {}
        }
      } else if (pattern.endsWith('*')) {
        params = matchRoute(pathname, pattern)
      } else {
        params = matchRoute(pathname, pattern)
      }

      if (params !== null) {
        const config = route.getSidebarConfig(params, context)
        return config
      }
    }
  }

  return null
}

const fetchProject = async (projectId: string) => {
  const response = await fetch(`/api/projects`)
  if (!response.ok) throw new Error('Failed to fetch projects')
  const projects = await response.json()
  return projects.find((p: any) => p.id === projectId)
}

const fetchAgent = async (agentId: string) => {
  const response = await fetch(`/api/agents/${agentId}/type`)
  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error('Failed to fetch agent')
  }
  return response.json()
}

export default function SidebarWrapper({ children }: SidebarWrapperProps) {
  const pathname = usePathname()
  const { user } = useUser()
  
  const { isMobile, mounted } = useMobile(768)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false)
  const [userCanViewApiKeys, setUserCanViewApiKeys] = useState<boolean>(false)
  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true)

  const { canAccessPhoneCalls, canAccessPhoneSettings } = useFeatureAccess()
  
  const projectId = pathname.match(/^\/([^/]+)/)?.[1]
  const agentId = pathname.match(/^\/[^/]+\/agents\/([^/?]+)/)?.[1]
  
  // Check if projectId is valid (not a reserved path)
  const isValidProjectId = projectId && !RESERVED_PATHS.includes(projectId)
  
  // Check if agentId is valid (not a reserved path)
  const agentReservedPaths = ['api-keys', 'sip-management']
  const isValidAgentId = agentId && !agentReservedPaths.includes(agentId)
  
  // Use React Query for project data
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: !!isValidProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const { data: agent } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => fetchAgent(agentId!),
    enabled: !!isValidAgentId && !!isValidProjectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('whispey-sidebar-collapsed')
      if (savedState !== null) {
        setIsDesktopCollapsed(JSON.parse(savedState))
      }
    }
  }, [])

  const handleDesktopToggle = () => {
    const newState = !isDesktopCollapsed
    setIsDesktopCollapsed(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem('whispey-sidebar-collapsed', JSON.stringify(newState))
    }
  }

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.emailAddresses?.[0]?.emailAddress || !isValidProjectId) {
        setPermissionsLoading(false)
        return
      }

      try {
        const { role } = await getUserProjectRole(user.emailAddresses[0].emailAddress, projectId!)
        setUserCanViewApiKeys(canViewApiKeys(role))
      } catch (error) {
        setUserCanViewApiKeys(false)
      } finally {
        setPermissionsLoading(false)
      }
    }

    fetchUserRole()
  }, [user, projectId, isValidProjectId])
  
  const isEnhancedProject = project?.id === ENHANCED_PROJECT_ID
  
  const sidebarContext: SidebarContext = {
    isEnhancedProject,
    userCanViewApiKeys,
    projectId,
    agentType: agent?.agent_type,
    canAccessPhoneCalls,
    canAccessPhoneSettings
  }
  
  const sidebarConfig = getSidebarConfig(pathname, sidebarContext)

  if (!sidebarConfig || !mounted) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <div className="h-screen flex">
      {isMobile ? (
        <>
          <div className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-gray-800 border-b flex items-center justify-between px-4 z-50 md:hidden">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Whispey" className="w-6 h-6" />
              <span className="font-semibold text-sm">Whispey</span>
            </div>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <VisuallyHidden>
                  <SheetTitle>Navigation Menu</SheetTitle>
                </VisuallyHidden>
                <Sidebar 
                  config={sidebarConfig} 
                  currentPath={pathname}
                  isCollapsed={false}
                  isMobile={true}
                />
              </SheetContent>
            </Sheet>
          </div>
          
          <main className="flex-1 pt-14 overflow-auto">
            {children}
          </main>
        </>
      ) : (
        <>
          <div className="relative">
            <Sidebar 
              config={sidebarConfig} 
              currentPath={pathname}
              isCollapsed={isDesktopCollapsed}
              onToggleCollapse={handleDesktopToggle}
              isMobile={false}
            />
          </div>
          
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </>
      )}
    </div>
  )
}