'use client'

import React, { useState, useEffect } from 'react'
import { useUser, SignedIn } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  Activity,
  BarChart3, 
  Settings, 
  Key,
  Users,
  Crown,
  HelpCircle,
  Sun,
  Moon,
  LogOut,
  List,
  FileText,
  Home,
  Webhook
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { GitHubStarsButton } from '../GithubLink'
import SupportSheet from './SupportPanel'

// Icon mapping
const ICONS = {
  Activity, 
  BarChart3, 
  Settings, 
  Key, 
  Users, 
  List, 
  FileText, 
  Home, 
  Webhook
} as const

interface NavigationItem {
  id: string
  name: string
  icon: keyof typeof ICONS
  path: string
  external?: boolean
  group?: string
}

interface NavigationGroup {
  id: string
  name: string
  items: NavigationItem[]
}

interface SidebarConfig {
  type: 'workspaces' | 'project-agents' | 'agent-detail'
  context: Record<string, any>
  navigation: NavigationItem[]
  showBackButton: boolean
  backPath?: string
  backLabel?: string
}

interface SidebarProps {
  config: SidebarConfig
  currentPath: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

// Pricing configurations per context - properly typed
const PRICING_CONFIGS: Record<SidebarConfig['type'], { showPricingBox: boolean; plan: string; features: string[]; upgradeText: string; upgradeLink: string }> = {
  workspaces: {
    showPricingBox: false,
    plan: 'Free Plan',
    features: ['5 Workspaces', 'Basic Analytics', 'Community Support'],
    upgradeText: 'Upgrade to Pro',
    upgradeLink: '/pricing'
  },
  'project-agents': {
    showPricingBox: false,
    plan: 'Team Plan',
    features: ['Unlimited Agents', 'Advanced Analytics', 'Priority Support'],
    upgradeText: 'Upgrade to Pro',
    upgradeLink: '/pricing'
  },
  'agent-detail': {
    showPricingBox: false,
    plan: '',
    features: [],
    upgradeText: '',
    upgradeLink: ''
  }
} as const

export default function Sidebar({ config, currentPath, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, isLoaded } = useUser()
  const searchParams = useSearchParams()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isSupportOpen, setIsSupportOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActiveLink = (path: string) => {
    // Handle tab-based navigation
    if (path.includes('?tab=')) {
      const [basePath, tabParam] = path.split('?tab=')
      const currentTab = searchParams.get('tab') || 'overview'
      return currentPath.startsWith(basePath) && tabParam === currentTab
    }
    
    // Exact match first
    if (currentPath === path) {
      return true
    }
    
    // For paths ending with just the project agents list (no sub-routes)
    // Only match if current path is exactly that path
    if (path.endsWith('/agents') && !path.includes('/agents/')) {
      return currentPath === path
    }
    
    // For sub-routes, check if current path matches exactly
    return currentPath === path
  }

  const getUserDisplayName = () => {
    if (user?.fullName) return user.fullName
    if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`
    if (user?.firstName) return user.firstName
    if (user?.emailAddresses?.[0]?.emailAddress) {
      return user.emailAddresses[0].emailAddress.split('@')[0]
    }
    return 'User'
  }

  const handleSignOut = () => {
    window.location.href = '/api/auth/logout'
  }

  // Group navigation items
  const groupedNavigation = (): NavigationGroup[] => {
    const groups: Record<string, NavigationItem[]> = {}
    const ungrouped: NavigationItem[] = []

    config.navigation.forEach(item => {
      if (item.group) {
        if (!groups[item.group]) {
          groups[item.group] = []
        }
        groups[item.group].push(item)
      } else {
        ungrouped.push(item)
      }
    })

    const result: NavigationGroup[] = []
    
    // Add ungrouped items first (no group header)
    if (ungrouped.length > 0) {
      result.push({
        id: 'ungrouped',
        name: '',
        items: ungrouped
      })
    }

    // Add grouped items
    Object.entries(groups).forEach(([groupId, items]) => {
      result.push({
        id: groupId,
        name: groupId,
        items
      })
    })

    return result
  }

  const renderNavigationItem = (item: NavigationItem) => {
    const Icon = ICONS[item.icon]
    const isActive = isActiveLink(item.path)
    
    const content = (
      <div className={`
        flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
        ${isActive 
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' 
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }
      `}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
        {!isCollapsed && (
          <span className="truncate">{item.name}</span>
        )}
      </div>
    )

    return item.external ? (
      <a key={item.id} href={item.path} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    ) : (
      <Link key={item.id} href={item.path}>
        {content}
      </Link>
    )
  }

  const renderContextHeader = () => {
    if (!isCollapsed && config.showBackButton) {
      return (
        <div className="space-y-2">
          <Link 
            href={config.backPath || '/'} 
            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            {config.backLabel || 'Back'}
          </Link>
        </div>
      )
    }
    return null
  }

  const pricingConfig = PRICING_CONFIGS[config.type]

  return (
    <>
      <aside className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 z-50 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        {/* Logo & Context Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <Link href="/" className="flex items-center gap-3 group mb-3">
            <Image 
              src="/logo.png" 
              alt="Whispey Logo" 
              width={32} 
              height={32} 
              className="flex-shrink-0 group-hover:scale-105 transition-transform duration-200" 
            />
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                  Whispey
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  LiveKit Platform
                </p>
              </div>
            )}
          </Link>

          {renderContextHeader()}
        </div>

        {/* Navigation with Groups */}
        <nav className="flex-1 p-3 space-y-1">
          {groupedNavigation().map((group, groupIndex) => (
            <div key={group.id}>
              {/* Group Header - only show if group has a name and we're not collapsed */}
              {group.name && !isCollapsed && (
                <div className={`px-3 py-2 ${groupIndex > 0 ? 'mt-4' : ''}`}>
                  <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    {group.name}
                  </h3>
                </div>
              )}
              
              {/* Group separator for collapsed mode */}
              {group.name && isCollapsed && groupIndex > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
              )}
              
              {/* Group Items */}
              <div className={`space-y-1 ${group.name && !isCollapsed ? 'ml-0' : ''}`}>
                {group.items.map(item => renderNavigationItem(item))}
              </div>
            </div>
          ))}
        </nav>

        {/* GitHub Stars */}
        {!isCollapsed && (
          <div className="px-3 mb-3">
            <GitHubStarsButton />
          </div>
        )}

        {/* Conditional Pricing Box */}
        {pricingConfig?.showPricingBox && !isCollapsed && (
          <div className="mx-3 mb-4 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-100">{pricingConfig.plan}</span>
            </div>
            {pricingConfig.features && (
              <ul className="space-y-1 mb-3">
                {pricingConfig.features.map((feature: string, index: number) => (
                  <li key={index} className="text-xs text-purple-700 dark:text-purple-300 flex items-center gap-1">
                    <div className="w-1 h-1 bg-purple-400 rounded-full flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            {pricingConfig.upgradeLink && (
              <Link href={pricingConfig.upgradeLink}>
                <Button size="sm" className="w-full text-xs h-7 bg-purple-600 hover:bg-purple-700 text-white">
                  {pricingConfig.upgradeText}
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* User Section */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-3">
          {!mounted || !isLoaded ? (
            <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse flex-shrink-0" />
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                  <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              )}
            </div>
          ) : (
            <SignedIn>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    isCollapsed ? 'justify-center' : ''
                  }`}>
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {getUserDisplayName().charAt(0).toUpperCase()}
                    </div>
                    {!isCollapsed && (
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{getUserDisplayName()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user?.emailAddresses?.[0]?.emailAddress}
                        </p>
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 shadow-lg border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{getUserDisplayName()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user?.emailAddresses?.[0]?.emailAddress}
                    </p>
                  </div>
                  <div className="py-1">
                    <DropdownMenuItem 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                      className="px-3 py-2 text-xs"
                    >
                      {mounted && theme === 'dark' ? (
                        <>
                          <Sun className="w-4 h-4 mr-2" />
                          Light Mode
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 mr-2" />
                          Dark Mode
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="px-3 py-2 text-xs">
                      <Link href="/settings">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="py-1">
                    <DropdownMenuItem onClick={handleSignOut} className="px-3 py-2 text-xs text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </SignedIn>
          )}
        </div>

        {/* Help Center */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-3">
          <button 
            onClick={() => setIsSupportOpen(true)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 w-full ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <HelpCircle className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Help Center</span>}
          </button>
        </div>
      </aside>

      {/* Support Sheet */}
      <SupportSheet 
        isOpen={isSupportOpen} 
        onClose={() => setIsSupportOpen(false)}
      />
    </>
  )
}