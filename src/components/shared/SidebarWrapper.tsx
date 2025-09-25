'use client'

import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useMobile } from '@/hooks/use-mobile'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { canViewApiKeys, getUserProjectRole } from '@/services/getUserRole'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface SidebarWrapperProps {
  children: ReactNode
}

const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'

// All your existing route pattern definitions and configurations
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

// Keep all your existing route matching and configuration logic
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

const sidebarRoutes: SidebarRoute[] = [
  {
    patterns: [
      { pattern: '/sign*' },
      { pattern: '/docs*' }
    ],
    getSidebarConfig: () => null,
    priority: 100
  },
  {
    patterns: [
      { pattern: '/:projectId/agents' },
      { pattern: '/:projectId/agents/api-keys' },
    ],
    getSidebarConfig: (params, context) => {
      const { projectId } = params
      const { userCanViewApiKeys } = context

      const baseNavigation = [
        {
          id: 'agent-list', 
          name: 'Agent List', 
          icon: 'Activity', 
          path: `/${projectId}/agents`, 
          group: 'Agents' 
        }
      ]

      const configurationItems = []
      if (userCanViewApiKeys) {
        configurationItems.push({
          id: 'api-keys',
          name: 'Project API Key',
          icon: 'Key',
          path: `/${projectId}/agents/api-keys`,
          group: 'configuration'
        })
      }

      return {
        type: 'project-agents',
        context: { projectId },
        navigation: [...baseNavigation, ...configurationItems],
        showBackButton: true,
        backPath: '/',
        backLabel: 'Back to Workspaces'
      }
    },
    priority: 95
  },
  {
    patterns: [
      { pattern: '/:projectId/agents/:agentId' },
      { pattern: '/:projectId/agents/:agentId/config' },
      { pattern: '/:projectId/agents/:agentId/observability' },
      { pattern: '/:projectId/agents/:agentId/phone-call-config' },
    ],
    getSidebarConfig: (params, context) => {
      const { projectId, agentId } = params
      const { isEnhancedProject, agentType } = context

      const reservedPaths = ['api-keys', 'settings', 'config', 'observability'];
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
        }
      ]

      // Configuration items
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

      // Call items
      const callItems = []
      if (agentType === 'pype_agent') {
        callItems.push({
          id: 'phone-call',
          name: 'Phone Calls',
          icon: 'Phone',
          path: `/${projectId}/agents/${agentId}/phone-call-config`,
          group: 'call configuration'
        })
      }

      // Enhanced project items
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

      // Combine all navigation items
      const navigation = [
        ...baseNavigation,
        ...configItems,
        // ...callItems,
        ...enhancedItems
      ]

      return {
        type: 'agent-detail',
        context: { agentId, projectId },
        navigation,
        showBackButton: true,
        backPath: `/${projectId}/agents`,
        backLabel: 'Back to Agents list'
      }
    },
    priority: 90
  },
  {
    patterns: [
      { pattern: '/', exact: true },
      { pattern: '*' }
    ],
    getSidebarConfig: () => ({
      type: 'workspaces',
      context: {},
      navigation: [
        { 
          id: 'workspaces', 
          name: 'Workspaces', 
          icon: 'Home', 
          path: '/' 
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

export default function SidebarWrapper({ children }: SidebarWrapperProps) {
  const pathname = usePathname()
  const { user } = useUser()
  
  const { isMobile, mounted } = useMobile(768)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false)
  const [userCanViewApiKeys, setUserCanViewApiKeys] = useState<boolean>(false)
  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true)
  
  const projectId = pathname.match(/^\/([^/]+)/)?.[1]
  const agentId = pathname.match(/^\/[^/]+\/agents\/([^/?]+)/)?.[1]
  
  const { data: projects } = useSupabaseQuery('pype_voice_projects', 
    projectId && projectId !== 'sign' && projectId !== 'docs' ? {
      select: 'id, name',
      filters: [{ column: 'id', operator: 'eq', value: projectId }]
    } : null
  )

  const { data: agents } = useSupabaseQuery('pype_voice_agents', 
    agentId && projectId && projectId !== 'sign' && projectId !== 'docs' ? {
      select: 'id, agent_type',
      filters: [{ column: 'id', operator: 'eq', value: agentId }]
    } : null
  )
  
  // Load collapse preference
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

  // Fetch user role and permissions (keep your existing logic)
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.emailAddresses?.[0]?.emailAddress || !projectId || projectId === 'sign' || projectId === 'docs') {
        setPermissionsLoading(false)
        return
      }

      try {
        const { role } = await getUserProjectRole(user.emailAddresses[0].emailAddress, projectId)
        setUserCanViewApiKeys(canViewApiKeys(role))
      } catch (error) {
        setUserCanViewApiKeys(false)
      } finally {
        setPermissionsLoading(false)
      }
    }

    fetchUserRole()
  }, [user, projectId])
  
  const project = projects?.[0]
  const agent = agents?.[0]
  const isEnhancedProject = project?.id === ENHANCED_PROJECT_ID
  
  const sidebarContext: SidebarContext = {
    isEnhancedProject,
    userCanViewApiKeys,
    projectId,
    agentType: agent?.agent_type
  }
  
  const sidebarConfig = getSidebarConfig(pathname, sidebarContext)

  if (!sidebarConfig || !mounted) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <div className="h-screen flex">
      {/* Mobile: Sheet-based sidebar */}
      {isMobile ? (
        <>
          {/* Mobile Header */}
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
          
          {/* Mobile Main Content */}
          <main className="flex-1 pt-14 overflow-auto">
            {children}
          </main>
        </>
      ) : (
        /* Desktop: Fixed sidebar */
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
          
          {/* Desktop Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </>
      )}
    </div>
  )
}