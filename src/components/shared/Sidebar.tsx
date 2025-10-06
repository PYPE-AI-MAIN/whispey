'use client'

import React, { useState, useEffect } from 'react'
import { useUser, SignedIn, useClerk } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import { useHotkeys } from 'react-hotkeys-hook'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
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
  Webhook,
  Phone,
  Download,
  Zap,
  Link as LinkIcon,
  User,
  Shield,
  UserPlus,
  TrendingUp,
  BarChart,
  CreditCard,
  History,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GitHubStarsButton } from '../GithubLink'
import SupportSheet from './SupportPanel'
import { SidebarConfig } from './SidebarWrapper'

// Extended icon mapping to support new page types
const ICONS = {
  Activity, 
  BarChart3, 
  Settings, 
  Key, 
  Users, 
  List, 
  FileText, 
  Home, 
  Webhook,
  Phone,
  Download,
  Zap,
  Link: LinkIcon,
  User,
  Shield,
  UserPlus,
  TrendingUp,
  BarChart,
  CreditCard,
  History
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

interface SidebarProps {
  config: SidebarConfig
  currentPath: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  isMobile?: boolean
  onMobileClose?: () => void
}

// Extended pricing configurations
const PRICING_CONFIGS: Record<string, { showPricingBox: boolean; plan: string; features: string[]; upgradeText: string; upgradeLink: string }> = {
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
  },
  'project-reports': {
    showPricingBox: true,
    plan: 'Pro Plan',
    features: ['Advanced Reports', 'Data Export', 'Custom Dashboards'],
    upgradeText: 'Upgrade to Pro',
    upgradeLink: '/pricing'
  },
  'project-integrations': {
    showPricingBox: false,
    plan: 'Enterprise',
    features: ['Unlimited Integrations', 'Custom Webhooks', 'Priority Support'],
    upgradeText: 'Contact Sales',
    upgradeLink: '/contact'
  }
} as const

export default function Sidebar({ 
  config, 
  currentPath, 
  isCollapsed = false, 
  onToggleCollapse,
  isMobile = false,
  onMobileClose 
}: SidebarProps) {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isSupportOpen, setIsSupportOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Hotkey for toggling sidebar
  useHotkeys('meta+B', (e) => {
    e.preventDefault()
    if (!isMobile && onToggleCollapse) {
      onToggleCollapse()
    }
  }, {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    enabled: !isMobile && !!onToggleCollapse
  })

  // Also add Ctrl+B for Windows/Linux users
  useHotkeys('ctrl+B', (e) => {
    e.preventDefault()
    if (!isMobile && onToggleCollapse) {
      onToggleCollapse()
    }
  }, {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    enabled: !isMobile && !!onToggleCollapse
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActiveLinkWithSearchParams = (path: string) => {
    // Split path and query string
    const [navPath, navQuery] = path.split('?')
    const [currentBasePath] = currentPath.split('?')
    
    // Special case: treat /observability route as part of Call Logs tab
    if (navQuery && navQuery.includes('tab=logs')) {
      // If nav item is for logs tab, also match /observability route
      const baseNavPath = navPath // e.g., /projectId/agents/agentId
      const observabilityPath = `${baseNavPath}/observability`
      
      if (currentBasePath === observabilityPath) {
        return true
      }
    }
    
    // Check if base path matches
    if (currentBasePath !== navPath) {
      return false
    }
  
    // If no query params in nav item, just check path
    if (!navQuery) {
      return currentBasePath === navPath
    }
  
    // Parse nav query params
    const navParams = new URLSearchParams(navQuery)
    
    // Special case: If nav item is for "tab=overview" and current URL has no tab parameter,
    // consider it active (since overview is the default tab)
    if (navParams.get('tab') === 'overview' && !searchParams.get('tab')) {
      return true
    }
    
    // Check if all nav params match current params
    for (const [key, value] of navParams.entries()) {
      if (searchParams.get(key) !== value) {
        return false
      }
    }
  
    return true
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

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await signOut({ redirectUrl: '/sign-in' })
    } catch (error) {
      console.error('Error signing out:', error)
      setIsSigningOut(false)
    }
  }

  // Group navigation items with better organization
  const groupedNavigation = (): NavigationGroup[] => {
    const groups: Record<string, NavigationItem[]> = {}
    const ungrouped: NavigationItem[] = []

    config.navigation.forEach((item: any) => { // TODO: fix type here
      if (item.group) {
        // Normalize group names for consistency
        const normalizedGroup = item.group.toLowerCase()
        if (!groups[normalizedGroup]) {
          groups[normalizedGroup] = []
        }
        groups[normalizedGroup].push(item)
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

    // Define group order for consistency
    const groupOrder = [
      'logs', 'agents', 'reports', 'analytics', 'integrations', 
      'team', 'settings', 'configuration', 'batch calls', 'resources'
    ]

    // Add groups in preferred order
    groupOrder.forEach(groupId => {
      if (groups[groupId]) {
        result.push({
          id: groupId,
          name: groupId === 'logs' ? 'LOGS' : 
                groupId === 'batch calls' ? 'Batch Calls' :
                groupId.charAt(0).toUpperCase() + groupId.slice(1),
          items: groups[groupId]
        })
        delete groups[groupId]
      }
    })

    // Add any remaining groups
    Object.entries(groups).forEach(([groupId, items]) => {
      result.push({
        id: groupId,
        name: groupId.charAt(0).toUpperCase() + groupId.slice(1),
        items
      })
    })

    return result
  }

  const renderNavigationItem = (item: NavigationItem) => {
    const Icon = ICONS[item.icon]
    const isActive = isActiveLinkWithSearchParams(item.path)
    
    if (!Icon) {
      console.warn(`Icon "${item.icon}" not found in ICONS mapping`)
      return null
    }
    
    const handleClick = () => {
      if (isMobile && onMobileClose) {
        onMobileClose()
      }
    }
    
    const content = (
      <div className={`
        flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
        ${isActive 
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' 
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }
        ${isCollapsed && !isMobile ? 'justify-center px-2' : ''}
      `}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
        {(!isCollapsed || isMobile) && (
          <span className="truncate">{item.name}</span>
        )}
      </div>
    )

    const navItem = item.external ? (
      <a key={item.id} href={item.path} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
        {content}
      </a>
    ) : (
      <Link key={item.id} href={item.path} onClick={handleClick}>
        {content}
      </Link>
    )

    // Wrap with tooltip when collapsed on desktop
    if (isCollapsed && !isMobile) {
      return (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              {navItem}
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{item.name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return navItem
  }

  const renderContextHeader = () => {
    if ((!isCollapsed || isMobile) && config.showBackButton) {
      return (
        <div className="space-y-2">
          <Link 
            href={config.backPath || '/'} 
            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            onClick={() => {
              if (isMobile && onMobileClose) {
                onMobileClose()
              }
            }}
          >
            <ArrowLeft className="w-3 h-3" />
            {config.backLabel || 'Back'}
          </Link>
        </div>
      )
    }
    return null
  }

  // Get pricing config with fallback for new types
  const pricingConfig = PRICING_CONFIGS[config.type] || {
    showPricingBox: false,
    plan: '',
    features: [],
    upgradeText: '',
    upgradeLink: ''
  }

  return (
    <>
      <aside className={`
        ${isMobile ? 'fixed left-0 top-0 h-full w-64' : 'relative'}
        ${!isMobile && isCollapsed ? 'w-16 h-full' : 'w-64 h-full'}
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 
        flex flex-col transition-all duration-300 ease-in-out z-50
        ${isMobile ? 'shadow-lg' : ''}
      `}>
        {/* Mobile Close Button */}
        {isMobile && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMobileClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Logo & Context Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 relative">
          <Link href="/" className="flex items-center gap-3 group mb-3" onClick={() => {
            if (isMobile && onMobileClose) {
              onMobileClose()
            }
          }}>
            <Image 
              src="/logo.png" 
              alt="Whispey Logo" 
              width={32} 
              height={32} 
              className="flex-shrink-0 group-hover:scale-105 transition-transform duration-200" 
            />
            {(!isCollapsed || isMobile) && (
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

          {/* Circular Collapse Button - positioned on the right edge */}
          {!isMobile && onToggleCollapse && (
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onToggleCollapse}
                      className="w-6 h-6 p-0 rounded-full border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out"
                      aria-label={isCollapsed ? 'Expand sidebar (Cmd+B)' : 'Collapse sidebar (Cmd+B)'}
                    >
                      <ChevronLeft 
                        className={`w-3 h-3 transition-transform duration-300 ease-in-out ${
                          isCollapsed ? 'rotate-180' : ''
                        }`} 
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-xs text-gray-500 mt-1">⌘ + B</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {renderContextHeader()}
        </div>

        {/* Navigation with Groups */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {groupedNavigation().map((group, groupIndex) => (
            <div key={group.id}>
              {/* Group Header - only show if group has a name and we're not collapsed */}
              {group.name && (!isCollapsed || isMobile) && (
                <div className={`px-3 py-2 ${groupIndex > 0 ? 'mt-4' : ''}`}>
                  <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    {group.name}
                  </h3>
                </div>
              )}
              
              {/* Group separator for collapsed mode */}
              {group.name && isCollapsed && !isMobile && groupIndex > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
              )}
              
              {/* Group Items */}
              <div className={`space-y-1 ${group.name && (!isCollapsed || isMobile) ? 'ml-0' : ''}`}>
                {group.items.map(item => renderNavigationItem(item))}
              </div>
            </div>
          ))}
        </nav>

        {/* GitHub Stars */}
        {(!isCollapsed || isMobile) && (
          <div className="px-3 mb-3">
            <GitHubStarsButton />
          </div>
        )}

        {/* Conditional Pricing Box */}
        {pricingConfig?.showPricingBox && (!isCollapsed || isMobile) && (
          <div className="mx-3 mb-4 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-100">{pricingConfig.plan}</span>
            </div>
            {pricingConfig.features && pricingConfig.features.length > 0 && (
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
              <Link href={pricingConfig.upgradeLink} onClick={() => {
                if (isMobile && onMobileClose) {
                  onMobileClose()
                }
              }}>
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
            <div className={`flex items-center gap-3 ${isCollapsed && !isMobile ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse flex-shrink-0" />
              {(!isCollapsed || isMobile) && (
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
                    isCollapsed && !isMobile ? 'justify-center' : ''
                  }`}>
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {getUserDisplayName().charAt(0).toUpperCase()}
                    </div>
                    {(!isCollapsed || isMobile) && (
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{getUserDisplayName()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user?.emailAddresses?.[0]?.emailAddress}
                        </p>
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align={isCollapsed && !isMobile ? "center" : "start"} 
                  side={isCollapsed && !isMobile ? "right" : "top"}
                  className="w-56 shadow-lg border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800"
                >
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
                    {/* <DropdownMenuItem asChild className="px-3 py-2 text-xs">
                      <Link href="/settings">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Link>
                    </DropdownMenuItem> */}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="py-1">
                    <DropdownMenuItem onClick={handleSignOut} className="px-3 py-2 text-xs text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400" disabled={isSigningOut}>
                      <LogOut className={`w-4 h-4 mr-2 ${isSigningOut ? 'animate-spin' : ''}`} />
                      {isSigningOut ? 'Signing out...' : 'Sign Out'}
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </SignedIn>
          )}
        </div>

        {/* Help Center */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => setIsSupportOpen(true)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 w-full ${
                    isCollapsed && !isMobile ? 'justify-center' : ''
                  }`}
                >
                  <HelpCircle className="w-4 h-4 flex-shrink-0" />
                  {(!isCollapsed || isMobile) && <span>Help Center</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Help Center</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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