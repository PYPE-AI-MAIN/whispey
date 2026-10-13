'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus, Phone, User, Calendar, Search, Loader2,
  MoreVertical, RefreshCw, Pause, Play, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  AlertCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Campaign } from '@/utils/campaigns/constants'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useQueryClient } from '@tanstack/react-query'
import { useProjectAgents } from '@/hooks/useProjectAgents'
import { resolveStoredAgentName } from '@/lib/agentDisplayName'

const PAGE_SIZE = 10

// ─── Pagination bar ──────────────────────────────────────────────────────────

interface PaginationProps {
  currentPage:  number
  totalPages:   number
  total:        number
  pageSize:     number
  isFetching:   boolean
  onPageChange: (page: number) => void
}

function Pagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  isFetching,
  onPageChange,
}: PaginationProps) {
  const from = Math.min((currentPage - 1) * pageSize + 1, total)
  const to   = Math.min(currentPage * pageSize, total)

  // Build visible page numbers: always show first, last, current ±1, with ellipsis
  const buildPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = []
    const addPage = (n: number) => { if (!pages.includes(n)) pages.push(n) }

    addPage(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) addPage(i)
    if (currentPage < totalPages - 2) pages.push('...')
    addPage(totalPages)

    return pages
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3 border-t border-border/60">
      {/* Count label */}
      <p className="text-xs text-muted-foreground whitespace-nowrap">
        {total === 0 ? 'No campaigns' : `Showing ${from}–${to} of ${total} campaign${total !== 1 ? 's' : ''}`}
      </p>

      {/* Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1 || isFetching}
            aria-label="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>

          {/* Previous */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || isFetching}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {buildPages().map((p, i) =>
              p === '...' ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-1 text-xs text-muted-foreground select-none"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p as number)}
                  disabled={isFetching}
                  className={`h-7 min-w-[28px] rounded-md px-2 text-xs font-medium transition-colors
                    ${p === currentPage
                      ? 'bg-blue-600 text-white shadow-sm cursor-default'
                      : 'text-muted-foreground hover:bg-muted disabled:opacity-50'
                    }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          {/* Next */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isFetching}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          {/* Last page */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || isFetching}
            aria-label="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

function Campaigns() {
  const router   = useRouter()
  const params   = useParams()
  const projectId = params.projectid as string
  const { data: agents = [] } = useProjectAgents(projectId)
  const queryClient = useQueryClient()

  const [page, setPage]               = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')   // debounced value sent to API

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [isSheetOpen, setIsSheetOpen]           = useState(false)
  const [actionLoading, setActionLoading]       = useState<string | null>(null)

  // Debounce search: wait 400 ms after the user stops typing, then reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, isFetching, isError, refetch } = useCampaigns({
    projectId,
    page,
    pageSize: PAGE_SIZE,
    search,
  })

  const campaigns  = data?.campaigns  ?? []
  const pagination = data?.pagination

  const invalidateAndRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['campaigns', projectId] })
  }, [queryClient, projectId])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      active:    'bg-success/15 text-success border-success/30',
      running:   'bg-success/15 text-success border-success/30',
      paused:    'bg-warning/15 text-warning border-warning/30',
      completed: 'bg-primary/15 text-primary border-primary/30',
      scheduled: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      failed:    'bg-destructive/15 text-destructive border-destructive/30',
      draft:     'bg-muted text-foreground border-border',
      ready:     'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
    }
    const cls = map[status.toLowerCase()] ?? map.active
    return (
      <Badge variant="outline" className={`${cls} text-xs`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const handlePauseCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to pause this campaign?')) return
    try {
      setActionLoading(campaignId)
      const res = await fetch('/api/campaigns/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to pause')
      invalidateAndRefetch()
    } catch (err: any) {
      alert(err.message || 'Failed to pause campaign')
    } finally {
      setActionLoading(null)
    }
  }

  const handleResumeCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to resume this campaign?')) return
    try {
      setActionLoading(campaignId)
      const res = await fetch('/api/campaigns/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to resume')
      invalidateAndRefetch()
    } catch (err: any) {
      alert(err.message || 'Failed to resume campaign')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) return
    try {
      setActionLoading(campaignId)
      const res = await fetch(`/api/campaigns/delete?campaignId=${campaignId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete')
      // If we deleted the last item on a page > 1, go back one page
      if (campaigns.length === 1 && page > 1) setPage(p => p - 1)
      invalidateAndRefetch()
    } catch (err: any) {
      alert(err.message || 'Failed to delete campaign')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  const SkeletonCard = () => (
    <div className="bg-background border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-3/4" />
            ))}
          </div>
          <div className="flex gap-4 pt-3 border-t border-border">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-16" />
            ))}
          </div>
        </div>
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderCampaignsContent = () => {
    if (isLoading) {
      return (
        <div className="grid gap-3">
          {[...Array(PAGE_SIZE)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )
    }

    if (campaigns.length === 0) {
      return (
        /* Empty states */
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-12 h-12 bg-primary/15 rounded-full flex items-center justify-center mb-3">
            <Phone className="w-6 h-6 text-primary" />
          </div>
          {search ? (
            <>
              <h3 className="text-sm font-medium text-foreground mb-1">
                No results for "{search}"
              </h3>
              <p className="text-xs text-muted-foreground mb-3 max-w-xs">
                Try a different name or clear the search.
              </p>
              <Button variant="outline" size="sm" onClick={() => setSearchInput('')} className="text-xs h-7">
                Clear Search
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium text-foreground mb-1">
                No campaigns yet
              </h3>
              <p className="text-xs text-muted-foreground mb-3 max-w-xs">
                Create your first campaign to start managing calls.
              </p>
              <Button onClick={() => router.push(`/${projectId}/campaigns/create`)} size="sm" className="h-9 text-xs gap-2">
                <Plus className="w-3 h-3" />
                Create Campaign
              </Button>
            </>
          )}
        </div>
      )
    }

    return (
      /* Campaign list */
      <div className="grid gap-3">
        {campaigns.map(campaign => (
          <div
            key={campaign.campaignId}
            onClick={() => router.push(`/${projectId}/campaigns/${campaign.campaignId}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/${projectId}/campaigns/${campaign.campaignId}`) } }}
            className={`relative bg-card  border border-border 
              rounded-lg p-4 hover:border-primary/40  hover:shadow-sm
              transition-all cursor-pointer group
              ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {campaign.campaignName}
                  </h3>
                  {getStatusBadge(campaign.status)}
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-muted-foreground">ID:</span>
                    <span className="font-mono truncate">{campaign.campaignId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{campaign.callConfig.provider}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{resolveStoredAgentName(agents, campaign.callConfig.agentName)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{formatDate(campaign.createdAt)}</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-border/60">
                  <Stat label="Total"   value={campaign.callStats?.total     ?? campaign.totalContacts}  />
                  <Stat label="Success" value={campaign.callStats?.completed ?? campaign.successCalls}   color="text-success" />
                  <Stat label="Failed"  value={campaign.callStats?.failed    ?? campaign.failedCalls}    color="text-destructive" />
                  <Stat label="Pending" value={campaign.callStats?.pending   ?? 0}                       color="text-muted-foreground" />
                </div>
              </div>

              {/* Actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100 hover:bg-muted"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={e => { e.stopPropagation(); setSelectedCampaign(campaign); setIsSheetOpen(true) }}
                  >
                    View Details
                  </DropdownMenuItem>

                  {(campaign.status === 'scheduled' || campaign.status === 'running') && (
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      disabled={actionLoading === campaign.campaignId}
                      onClick={e => handlePauseCampaign(campaign.campaignId, e)}
                    >
                      <Pause className="w-3 h-3 mr-2" />
                      {actionLoading === campaign.campaignId ? 'Pausing…' : 'Pause'}
                    </DropdownMenuItem>
                  )}

                  {campaign.status === 'paused' && (
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      disabled={actionLoading === campaign.campaignId}
                      onClick={e => handleResumeCampaign(campaign.campaignId, e)}
                    >
                      <Play className="w-3 h-3 mr-2" />
                      {actionLoading === campaign.campaignId ? 'Resuming…' : 'Resume'}
                    </DropdownMenuItem>
                  )}

                  {['paused', 'draft', 'completed', 'ready'].includes(campaign.status) && (
                    <DropdownMenuItem
                      className="text-xs text-destructive cursor-pointer"
                      disabled={actionLoading === campaign.campaignId}
                      onClick={e => handleDeleteCampaign(campaign.campaignId, e)}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      {actionLoading === campaign.campaignId ? 'Deleting…' : 'Delete'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Subtle loading overlay when fetching next page */}
            {isFetching && (
              <div className="absolute inset-0 rounded-lg bg-white/40 dark:bg-gray-800/40" />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* ── Header ── */}
      <div className="bg-background flex-shrink-0">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-8 flex items-center justify-between pt-6 pb-4 sm:pt-8">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Campaigns</h1>
              {pagination && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {pagination.total} {pagination.total === 1 ? 'campaign' : 'campaigns'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => invalidateAndRefetch()}
              variant="outline"
              size="sm"
              className="h-9 text-sm gap-2 px-4"
              disabled={isFetching}
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => router.push(`/${projectId}/campaigns/create`)}
              size="sm"
              className="h-9 text-sm gap-2 px-4"
            >
              <Plus className="w-3 h-3" />
              Create Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="bg-background flex-shrink-0">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-8 pb-4"><div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns by name or ID…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div></div>
      </div>

      {/* ── Error banner ── */}
      {isError && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Failed to load campaigns. Check your connection and try refreshing.
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-8">
          {/* Initial loading skeletons / empty states / campaign list */}
          {renderCampaignsContent()}
        </div>
      </div>

      {/* ── Pagination bar ── */}
      {!isLoading && !isError && pagination && (
        <div className="bg-card border-t border-border/60 flex-shrink-0">
          <div className="mx-auto w-full max-w-6xl px-4 pb-2 sm:px-8">
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={PAGE_SIZE}
              isFetching={isFetching}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* ── Detail sheet ── */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-muted/50 p-0">
          <div className="sticky top-0 z-10 bg-muted/50 px-6 py-5 border-b border-border">
            <SheetTitle className="text-xl font-bold text-foreground">Campaign Details</SheetTitle>
          </div>

          {selectedCampaign && (
            <div className="p-4 sm:p-6 space-y-6">
              {/* Header */}
              <div className="rounded-xl border border-border bg-card shadow-sm p-4 sm:p-6">
                <h3 className="text-xl font-bold text-foreground mb-4">
                  {selectedCampaign.campaignName}
                </h3>
                <div className="flex items-center gap-3 flex-wrap">
                  {getStatusBadge(selectedCampaign.status)}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(selectedCampaign.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="rounded-xl border border-border bg-card shadow-sm p-4 sm:p-6">
                <h4 className="text-xs font-medium text-muted-foreground mb-4">Campaign Information</h4>
                <InfoRow label="Campaign ID"  value={<span className="font-mono">{selectedCampaign.campaignId}</span>} />
                <InfoRow label="Organization ID"   value={<span className="font-mono">{selectedCampaign.projectId}</span>} />
                <InfoRow label="Provider"     value={selectedCampaign.callConfig.provider} />
              </div>

              {/* Agent */}
              <div className="rounded-xl border border-border bg-card shadow-sm p-4 sm:p-6">
                <h4 className="text-xs font-medium text-muted-foreground mb-4">Agent Details</h4>
                <InfoRow label="Agent Name"  value={resolveStoredAgentName(agents, selectedCampaign.callConfig.agentName)} />
                <InfoRow label="SIP Trunk"   value={<span className="font-mono">{selectedCampaign.callConfig.sipTrunkId}</span>} />
              </div>

              {/* Metrics */}
              <div className="rounded-xl border border-border bg-card shadow-sm p-4 sm:p-6">
                <h4 className="text-xs font-medium text-muted-foreground mb-5">Performance Metrics</h4>
                <div className="space-y-4">
                  <MetricRow label="Total Contacts" value={selectedCampaign.callStats?.total   ?? selectedCampaign.totalContacts} />
                  <MetricRow label="Successful"      value={selectedCampaign.callStats?.completed ?? selectedCampaign.successCalls} color="text-success" />
                  <MetricRow label="Failed"          value={selectedCampaign.callStats?.failed    ?? selectedCampaign.failedCalls}  color="text-destructive" />
                  <MetricRow label="Pending"         value={selectedCampaign.callStats?.pending   ?? 0}                             color="text-muted-foreground" />
                </div>

                {/* Progress bar */}
                {(() => {
                  const total     = selectedCampaign.callStats?.total ?? selectedCampaign.processedContacts
                  const completed = selectedCampaign.callStats?.completed ?? selectedCampaign.successCalls
                  const rate      = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
                  return (
                    <div className="mt-5 pt-4 border-t border-border/60">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground">Completion Rate</span>
                        <span className="text-sm font-bold text-foreground">{rate}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  )
                })()}
              </div>

              <Button
                onClick={() => { setIsSheetOpen(false); router.push(`/${projectId}/campaigns/${selectedCampaign.campaignId}`) }}
                className="w-full text-sm h-11 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold"
              >
                View Full Campaign Details
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Tiny shared sub-components ───────────────────────────────────────────────

function Stat({ label, value, color = 'text-foreground' }: Readonly<{ label: string; value: number; color?: string }>) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className={`text-xs font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}

function MetricRow({ label, value, color = 'text-foreground' }: Readonly<{ label: string; value: number; color?: string }>) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
    </div>
  )
}

export default Campaigns
