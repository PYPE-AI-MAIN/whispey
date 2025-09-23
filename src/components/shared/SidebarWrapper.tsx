'use client'

import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import Sidebar from './Sidebar'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { canViewApiKeys, getUserProjectRole } from '@/services/getUserRole'

interface SidebarWrapperProps {
  children: ReactNode
}

const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'

// Route pattern definitions
interface RoutePattern {
  pattern: string
  exact?: boolean
}

interface SidebarRoute {
  patterns: RoutePattern[]
  getSidebarConfig: (params: RouteParams, context: SidebarContext) => SidebarConfig | null
  priority?: number // Higher priority routes are checked first
}

interface RouteParams {
  [key: string]: string
}

interface SidebarContext {
  isEnhancedProject: boolean
  userCanViewApiKeys: boolean
  projectId?: string
  agentType?: string // Add agent type to context
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

// Improved utility function to parse route patterns and extract parameters
const matchRoute = (pathname: string, pattern: string): RouteParams | null => {
  // Handle wildcard patterns first
  if (pattern.endsWith('*')) {
    const basePattern = pattern.slice(0, -1) // Remove the '*'
    if (!pathname.startsWith(basePattern)) {
      return null
    }
    
    // Extract parameters from the base pattern (without the wildcard)
    const paramNames: string[] = []
    const regexPattern = basePattern
      .replace(/:[^/]+/g, (match) => {
        paramNames.push(match.slice(1)) // Remove the ':'
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

  // Handle exact patterns
  const paramNames: string[] = []
  const regexPattern = pattern
    .replace(/:[^/]+/g, (match) => {
      paramNames.push(match.slice(1)) // Remove the ':'
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

// Define all sidebar routes with their configurations
const sidebarRoutes: SidebarRoute[] = [
  // Auth and docs pages - no sidebar (highest priority)
  {
    patterns: [
      { pattern: '/sign*' },
      { pattern: '/docs*' }
    ],
    getSidebarConfig: () => null,
    priority: 100
  },

  // Project agents routes - Both list and api-keys pages (high priority)
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

  // Individual agent detail pages (high priority but less than project routes above)
  {
    patterns: [
      { pattern: '/:projectId/agents/:agentId' },
      { pattern: '/:projectId/agents/:agentId/config' },
      { pattern: '/:projectId/agents/:agentId/observability' },
    ],
    getSidebarConfig: (params, context) => {
      const { projectId, agentId } = params
      const { isEnhancedProject, agentType } = context

      // Additional safety check to prevent reserved words from being treated as agent IDs
      const reservedPaths = ['api-keys', 'settings', 'config', 'observability'];
      if (reservedPaths.includes(agentId)) {
        return null; // Let other routes handle this
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

      // Show Agent Config for pype_agent type agents (instead of checking project ID)
      if (agentType === 'pype_agent') {
        baseNavigation.push({ 
          id: 'agent-config', 
          name: 'Agent Config', 
          icon: 'Settings', 
          path: `/${projectId}/agents/${agentId}/config`, 
          group: 'configuration' 
        })
      }

      const navigation = isEnhancedProject ? [
        ...baseNavigation,
        { 
          id: 'campaign-logs', 
          name: 'Campaign Logs', 
          icon: 'BarChart3', 
          path: `/${projectId}/agents/${agentId}?tab=campaign-logs`, 
          group: 'Batch Calls' 
        }
      ] : baseNavigation

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

  // Default home/workspaces sidebar (lowest priority)
  {
    patterns: [
      { pattern: '/', exact: true },
      { pattern: '*' } // Catch-all
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

// Main function to get sidebar configuration
const getSidebarConfig = (
  pathname: string, 
  context: SidebarContext
): SidebarConfig | null => {
  // Sort routes by priority (highest first)
  const sortedRoutes = [...sidebarRoutes].sort((a, b) => (b.priority || 0) - (a.priority || 0))

  // Debug logging to help troubleshoot
  
  for (const route of sortedRoutes) {
    for (const { pattern, exact } of route.patterns) {
      let params: RouteParams | null = null

      if (exact) {
        // Exact match
        if (pathname === pattern) {
          params = {}
        }
      } else if (pattern.endsWith('*')) {
        // Wildcard match
        params = matchRoute(pathname, pattern)
        if (params) {
        }
      } else {
        // Pattern match
        params = matchRoute(pathname, pattern)
        if (params) {
        }
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
  
  const [userCanViewApiKeys, setUserCanViewApiKeys] = useState<boolean>(false)
  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true)
  
  // Extract project ID and agent ID from pathname
  const projectId = pathname.match(/^\/([^/]+)/)?.[1]
  const agentId = pathname.match(/^\/[^/]+\/agents\/([^/?]+)/)?.[1]
  
  // Fetch project data
  const { data: projects } = useSupabaseQuery('pype_voice_projects', 
    projectId && projectId !== 'sign' && projectId !== 'docs' ? {
      select: 'id, name',
      filters: [{ column: 'id', operator: 'eq', value: projectId }]
    } : null
  )

  // Fetch agent data when we have an agent ID to get the agent_type
  const { data: agents } = useSupabaseQuery('pype_voice_agents', 
    agentId && projectId && projectId !== 'sign' && projectId !== 'docs' ? {
      select: 'id, agent_type',
      filters: [{ column: 'id', operator: 'eq', value: agentId }]
    } : null
  )
  
  // Fetch user role and permissions
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
  const agent = agents?.[0] // Get the agent data
  const isEnhancedProject = project?.id === ENHANCED_PROJECT_ID
  
  const sidebarContext: SidebarContext = {
    isEnhancedProject,
    userCanViewApiKeys,
    projectId,
    agentType: agent?.agent_type // Pass the agent_type from the database query
  }
  
  const sidebarConfig = getSidebarConfig(pathname, sidebarContext)

  // No sidebar - full width layout
  if (!sidebarConfig) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar config={sidebarConfig} currentPath={pathname} />
      
      <main className="flex-1 ml-64 overflow-auto">
        {children}
      </main>
    </div>
  )
}