'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronDown, X, Megaphone, Loader2, AlertCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface Campaign {
  campaignId: string
  campaignName: string
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | string
  totalContacts?: number
  createdAt?: string
  agentId?: string
}

interface CampaignSelectorProps {
  projectId: string
  agentId: string
  selectedCampaign: Campaign | null
  onSelect: (campaign: Campaign | null) => void
}

const STATUS_STYLES: Record<string, string> = {
  running:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  paused:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  draft:     'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

export const CampaignSelector: React.FC<CampaignSelectorProps> = ({
  projectId,
  agentId,
  selectedCampaign,
  onSelect,
}) => {
  const [open, setOpen] = useState(false)
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!projectId || fetchedRef.current) return
    fetchedRef.current = true

    const fetchCampaigns = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/campaigns/list?projectId=${encodeURIComponent(projectId)}&agentId=${encodeURIComponent(agentId)}&limit=100`
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load campaigns')
        const list: Campaign[] = json.campaigns ?? json.items ?? json.data ?? []
        const agentIdUnderscored = agentId.replace(/-/g, '_')
        const agentFiltered = list.filter(c => {
          const agentName: string | undefined = (c as any).callConfig?.agentName
          if (!agentName) return true
          return agentName.includes(agentIdUnderscored)
        })
        setAllCampaigns(agentFiltered)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchCampaigns()
  }, [projectId, agentId])

  // Filter to last 14 days, then apply search
  const filtered = useMemo(() => {
    const cutoff = Date.now() - FOURTEEN_DAYS_MS
    return allCampaigns
      .filter(c => {
        if (c.createdAt) {
          const age = new Date(c.createdAt).getTime()
          if (!isNaN(age) && age < cutoff) return false
        }
        return true
      })
      .filter(c =>
        !search.trim() ||
        c.campaignName.toLowerCase().includes(search.trim().toLowerCase())
      )
  }, [allCampaigns, search])

  const handleSelect = (campaign: Campaign) => {
    onSelect(campaign)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5 text-sm font-medium transition-colors max-w-[200px]',
            selectedCampaign
              ? 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {selectedCampaign ? selectedCampaign.campaignName : 'Campaign'}
          </span>
          {selectedCampaign ? (
            <span
              role="button"
              onClick={handleClear}
              className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors shrink-0"
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0 shadow-lg" align="start" sideOffset={6}>
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {search ? 'No campaigns match' : 'No recent campaigns'}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map(campaign => {
              const isSelected = selectedCampaign?.campaignId === campaign.campaignId
              const statusStyle = STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft

              return (
                <button
                  key={campaign.campaignId}
                  onClick={() => handleSelect(campaign)}
                  className={cn(
                    'w-full flex items-start gap-2 px-3 py-2 text-left transition-colors',
                    'hover:bg-muted/60 dark:hover:bg-gray-800/60',
                    isSelected && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate leading-tight">
                        {campaign.campaignName}
                      </span>
                      {isSelected && (
                        <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', statusStyle)}>
                        {campaign.status}
                      </span>
                      {campaign.totalContacts !== undefined && (
                        <span className="text-[11px] text-muted-foreground">
                          {campaign.totalContacts.toLocaleString()} contacts
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!loading && !error && allCampaigns.length > filtered.length && !search && (
          <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            Showing last 14 days · {allCampaigns.length - filtered.length} older hidden
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
