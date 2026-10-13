'use client'

import { Skeleton } from '@/components/ui/skeleton'
import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  ChevronsUpDown, 
  Plus, 
  Check,
  Building2,
  Loader2
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Organization {
  id: string
  name: string
  description?: string
  environment: string
  agent_count?: number
}

interface OrganizationSwitcherProps {
  isCollapsed?: boolean
  isMobile?: boolean
  onCreateNew?: () => void
  externalOpen?: boolean
  onExternalOpenChange?: (open: boolean) => void
}

// React Query fetch function
const fetchOrganizations = async (): Promise<Organization[]> => {
  const res = await fetch('/api/projects')
  if (!res.ok) throw new Error('Failed to fetch organizations')
  return res.json()
}

function orgButtonLabel(loading: boolean, name?: string): string {
  if (loading) return 'Organization'
  return name ?? 'Select Organization'
}

export default function OrganizationSwitcher({ 
  isCollapsed = false, 
  isMobile = false,
  onCreateNew,
  externalOpen,
  onExternalOpenChange 
}: OrganizationSwitcherProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = (value: boolean) => {
    setInternalOpen(value)
    onExternalOpenChange?.(value)
  }

  const router = useRouter()
  const pathname = usePathname()

  // Use React Query for data fetching
  const { data: organizations = [], isLoading: loading } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  })

  // Extract current org ID from pathname
  const currentOrgId = pathname.match(/^\/([^/]+)/)?.[1]
  
  // Get last visited org from localStorage
  const [lastVisitedOrgId, setLastVisitedOrgId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('whispey-last-org')
    }
    return null
  })

  // Save current org to localStorage when URL changes
  useEffect(() => {
    if (currentOrgId && currentOrgId !== 'sign' && currentOrgId !== 'docs' && currentOrgId !== 'projects') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('whispey-last-org', currentOrgId)
        setLastVisitedOrgId(currentOrgId)
      }
    }
  }, [currentOrgId])

  const handleSelect = (orgId: string) => {
    setOpen(false)
    // Save selected org to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('whispey-last-org', orgId)
      setLastVisitedOrgId(orgId)
    }
    router.push(`/${orgId}/agents`)
  }

  const handleCreateNew = () => {
    setOpen(false)
    // Small delay to allow dialog close animation to complete before opening new one
    setTimeout(() => {
      if (onCreateNew) {
        onCreateNew()
      }
    }, 150)
  }

  const getOrganizationInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
  }

  const getEnvironmentColor = (environment: string) => {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        return 'bg-red-500/10 text-destructive dark:bg-red-500/10'
      case 'development':
      case 'dev':
        return 'bg-blue-500/10 text-primary dark:bg-blue-500/10'
      default:
        return 'bg-muted-foreground/10 text-muted-foreground'
    }
  }

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (org.description && org.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Determine which organization to display
  // Priority: 1. Current URL org, 2. Last visited org, 3. First org in list
  const currentOrg = organizations.find(org => org.id === currentOrgId)
  const lastVisitedOrg = organizations.find(org => org.id === lastVisitedOrgId)
  const displayOrg = currentOrg || lastVisitedOrg || organizations[0]

  const buttonContent = (
    <button
      onClick={() => setOpen(true)}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer w-full
        text-foreground  hover:bg-muted/50  hover:text-foreground 
        ${isCollapsed && !isMobile ? 'justify-center px-2' : ''}
      `}
    >
      {loading ? (
        <>
          <Skeleton className="h-6 w-6 flex-shrink-0 rounded" />
          {(!isCollapsed || isMobile) && <Skeleton className="h-3 flex-1" />}
        </>
      ) : (
        <>
          {displayOrg ? (
            <>
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center text-white font-medium text-[10px] flex-shrink-0">
                {getOrganizationInitials(displayOrg.name)}
              </div>
              {(!isCollapsed || isMobile) && (
                <>
                  <span className="truncate flex-1 text-left text-xs">
                    {displayOrg.name}
                  </span>
                  <ChevronsUpDown className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                </>
              )}
            </>
          ) : (
            <>
              <Building2 className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              {(!isCollapsed || isMobile) && (
                <>
                  <span className="truncate flex-1 text-left text-xs">
                    Select Organization
                  </span>
                  <ChevronsUpDown className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                </>
              )}
            </>
          )}
        </>
      )}
    </button>
  )

  return (
    <>
      {isCollapsed && !isMobile ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {buttonContent}
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{orgButtonLabel(loading, displayOrg?.name)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        buttonContent
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-md backdrop-blur-xl bg-card/95 border-border">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/60">
            <DialogTitle className="text-sm font-semibold text-foreground">Switch Organization</DialogTitle>
          </DialogHeader>

          <Command className="rounded-none border-none bg-transparent">
            <div className="px-3 py-2">
              <CommandInput 
                placeholder="Search organizations..." 
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="h-8 text-xs bg-muted/50 border-border pl-3"
              />
            </div>
            
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>
                <div className="text-center py-6">
                  <Building2 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No organizations found</p>
                </div>
              </CommandEmpty>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Current Organization */}
                  {(() => {
                    const selectedOrg = filteredOrganizations.find(org => 
                      currentOrgId === org.id || (!currentOrgId && lastVisitedOrgId === org.id)
                    )
                    
                    if (!selectedOrg) return null
                    
                    return (
                      <CommandGroup heading="Current Organization" className="px-2 pb-2">
                        <CommandItem
                          key={selectedOrg.id}
                          value={selectedOrg.name}
                          onSelect={() => handleSelect(selectedOrg.id)}
                          className="cursor-pointer px-2 py-2 rounded-md transition-colors bg-primary/10 border border-primary/30"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center text-white font-medium text-[10px] flex-shrink-0">
                              {getOrganizationInitials(selectedOrg.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-medium text-xs truncate text-blue-900 dark:text-blue-100">
                                  {selectedOrg.name}
                                </span>
                                <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] font-normal ${getEnvironmentColor(selectedOrg.environment)} border-0 px-1.5 py-0 h-4`}
                                >
                                  {selectedOrg.environment}
                                </Badge>
                                {selectedOrg.agent_count !== undefined && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {selectedOrg.agent_count} agents
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CommandItem>
                      </CommandGroup>
                    )
                  })()}

                  {/* Other Organizations */}
                  {(() => {
                    const otherOrgs = filteredOrganizations.filter(org => 
                      !(currentOrgId === org.id || (!currentOrgId && lastVisitedOrgId === org.id))
                    )
                    
                    if (otherOrgs.length === 0) return null
                    
                    return (
                      <CommandGroup heading="Other Organizations" className="px-2 pb-2">
                        {otherOrgs.map((org) => (
                          <CommandItem
                            key={org.id}
                            value={org.name}
                            onSelect={() => handleSelect(org.id)}
                            className="cursor-pointer px-2 py-2 rounded-md transition-colors aria-selected:bg-muted/50 border border-transparent"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center text-white font-medium text-[10px] flex-shrink-0">
                                {getOrganizationInitials(org.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="font-medium text-xs truncate text-foreground">
                                    {org.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-[10px] font-normal ${getEnvironmentColor(org.environment)} border-0 px-1.5 py-0 h-4`}
                                  >
                                    {org.environment}
                                  </Badge>
                                  {org.agent_count !== undefined && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {org.agent_count} agents
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )
                  })()}
                </>
              )}
            </CommandList>
          </Command>

          <div className="px-4 py-3 border-t border-border/60 backdrop-blur-sm">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleCreateNew}
                  variant="ghost"
                  size="sm"
                  className="w-fit justify-start text-xs h-7 text-foreground hover:bg-muted/50 font-normal px-2"
                >
                  <Plus className="w-3 h-3 mr-1.5" />
                  Create new organization
                </Button>
                <kbd className="px-1.5 py-0.5 font-mono bg-gray-800/50 dark:bg-gray-700/50 text-muted-foreground border border-gray-700 dark:border-gray-600 rounded text-[10px]">N</kbd>
              </div>
              
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-gray-800/50 dark:bg-gray-700/50 text-muted-foreground border border-gray-700 dark:border-gray-600 rounded">↑↓</kbd>
                  <span>navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-gray-800/50 dark:bg-gray-700/50 text-muted-foreground border border-gray-700 dark:border-gray-600 rounded">↵</kbd>
                  <span>select</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Export function to invalidate the organizations cache
export const invalidateOrganizationsCache = (queryClient: any) => {
  queryClient.invalidateQueries({ queryKey: ['organizations'] })
}