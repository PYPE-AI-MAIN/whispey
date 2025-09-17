'use client'

import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import { useSupabaseQuery } from '@/hooks/useSupabase'

interface SidebarWrapperProps {
  children: ReactNode
}

const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'

// Define sidebar configurations for different contexts
const getSidebarConfig = (pathname: string, projectId?: string, isEnhancedProject?: boolean) => {
    // No sidebar for auth pages and docs
    if (pathname.startsWith('/sign') || pathname.startsWith('/docs')) {
      return null
    }
  
    // Individual agent detail page - match /{projectId}/agents/{agentId}
    // This should be checked first as it's more specific
    if (pathname.match(/^\/[^/]+\/agents\/[^/]+$/) && !pathname.includes('/api-keys') && !pathname.includes('/analytics')) {
      const matches = pathname.match(/^\/([^/]+)\/agents\/([^/]+)$/)
      const currentProjectId = matches?.[1]
      const agentId = matches?.[2]
      
      // Base navigation items
      const baseNavigation = [
        { id: 'overview', name: 'Overview', icon: 'Activity' as const, path: `/${currentProjectId}/agents/${agentId}?tab=overview`, group: 'LOGS' },
        { id: 'logs', name: 'Call Logs', icon: 'List' as const, path: `/${currentProjectId}/agents/${agentId}?tab=logs`, group: 'LOGS' }
      ]
      
      // Add campaign logs only for enhanced projects
      const navigation = isEnhancedProject ? [
        ...baseNavigation,
        { id: 'campaign-logs', name: 'Campaign Logs', icon: 'BarChart3' as const, path: `/${currentProjectId}/agents/${agentId}?tab=campaign-logs`, group: 'Batch Calls' }
      ] : baseNavigation
      
      return {
        type: 'agent-detail' as const,
        context: { agentId },
        navigation,
        showBackButton: true,
        backPath: `/${currentProjectId}/agents`,
        backLabel: 'Back to Agents list'
      }
    }
  
    // Project agents list and related pages - match /{projectId}/agents and /{projectId}/agents/*
    if (pathname.match(/^\/[^/]+\/agents/)) {
      const matches = pathname.match(/^\/([^/]+)\/agents/)
      const currentProjectId = matches?.[1]
      return {
        type: 'project-agents' as const,
        context: { projectId: currentProjectId },
        navigation: [
          // Management group
          { id: 'agent-list', name: 'Agent List', icon: 'Activity' as const, path: `/${currentProjectId}/agents`, group: 'Agents' },
          
          // Configuration group
          { id: 'api-keys', name: 'Project API Key', icon: 'Key' as const, path: `/${currentProjectId}/agents/api-keys`, group: 'configuration' },
          // { id: 'webhooks', name: 'Webhooks', icon: 'Webhook' as const, path: `/${currentProjectId}/webhooks`, group: 'configuration' },
          { id: 'settings', name: 'Settings', icon: 'Settings' as const, path: `/${currentProjectId}/settings`, group: 'configuration' }
        ],
        showBackButton: true,
        backPath: '/',
        backLabel: 'Back to Workspaces'
      }
    }
  
    // Default home sidebar for workspace selection
    return {
      type: 'workspaces' as const,
      context: {},
      navigation: [
        // Main navigation (no group)
        { id: 'workspaces', name: 'Workspaces', icon: 'Home' as const, path: '/' },      
        // Resources group
        { id: 'docs', name: 'Documentation', icon: 'FileText' as const, path: '/docs', external: true, group: 'resources' }
      ],
      showBackButton: false
    }
  }

export default function SidebarWrapper({ children }: SidebarWrapperProps) {
  const pathname = usePathname()
  
  // Extract project ID from pathname
  const projectId = pathname.match(/^\/([^/]+)/)?.[1]
  
  // Fetch project data only when we have a project ID
  const { data: projects } = useSupabaseQuery('pype_voice_projects', 
    projectId && projectId !== 'sign' && projectId !== 'docs' ? {
      select: 'id, name',
      filters: [{ column: 'id', operator: 'eq', value: projectId }]
    } : null
  )
  
  const project = projects?.[0]
  const isEnhancedProject = project?.id === ENHANCED_PROJECT_ID
  
  const sidebarConfig = getSidebarConfig(pathname, projectId, isEnhancedProject)

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