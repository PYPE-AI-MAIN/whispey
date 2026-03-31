'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3 border-t border-gray-100 dark:border-gray-800">
      {/* Count label */}
      <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
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
                  className="px-1 text-xs text-gray-400 dark:text-gray-500 select-none"
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
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50'
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
      active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
      running:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
      paused:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      scheduled: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
      draft:     'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800',
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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            ))}
          </div>
          <div className="flex gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            ))}
          </div>
        </div>
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Campaigns</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage and monitor your calling campaigns
                {pagination && (
                  <span className="ml-1 text-gray-400 dark:text-gray-500">
                    · {pagination.total} total
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => invalidateAndRefetch()}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              disabled={isFetching}
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => router.push(`/${projectId}/campaigns/create`)}
              size="sm"
              className="h-7 text-xs gap-1.5"
            >
              <Plus className="w-3 h-3" />
              Create Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search campaigns by name or ID…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {isError && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Failed to load campaigns. Check your connection and try refreshing.
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-4">

        {/* Initial loading skeletons */}
        {isLoading ? (
          <div className="grid gap-3">
            {[...Array(PAGE_SIZE)].map((_, i) => <SkeletonCard key={i} />)}
          </div>

        ) : campaigns.length === 0 ? (

          /* Empty states */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3">
              <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            {search ? (
              <>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  No results for "{search}"
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-xs">
                  Try a different name or clear the search.
                </p>
                <Button variant="outline" size="sm" onClick={() => setSearchInput('')} className="text-xs h-7">
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  No campaigns yet
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-xs">
                  Create your first campaign to start managing calls.
                </p>
                <Button onClick={() => router.push(`/${projectId}/campaigns/create`)} size="sm" className="h-7 text-xs gap-2">
                  <Plus className="w-3 h-3" />
                  Create Campaign
                </Button>
              </>
            )}
          </div>

        ) : (
          /* Campaign list */
          <div className="grid gap-3">
            {campaigns.map(campaign => (
              <div
                key={campaign.campaignId}
                onClick={() => router.push(`/${projectId}/campaigns/${campaign.campaignId}`)}
                className={`relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                  rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm
                  transition-all cursor-pointer group
                  ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {campaign.campaignName}
                      </h3>
                      {getStatusBadge(campaign.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-500 dark:text-gray-500">ID:</span>
                        <span className="font-mono truncate">{campaign.campaignId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{campaign.callConfig.provider}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{campaign.callConfig.agentName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{formatDate(campaign.createdAt)}</span>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700">
                      <Stat label="Total"   value={campaign.callStats?.total     ?? campaign.totalContacts}  />
                      <Stat label="Success" value={campaign.callStats?.completed ?? campaign.successCalls}   color="text-green-600 dark:text-green-400" />
                      <Stat label="Failed"  value={campaign.callStats?.failed    ?? campaign.failedCalls}    color="text-red-600 dark:text-red-400" />
                      <Stat label="Pending" value={campaign.callStats?.pending   ?? 0}                       color="text-gray-500 dark:text-gray-400" />
                    </div>
                  </div>

                  {/* Actions menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                          className="text-xs text-red-600 dark:text-red-400 cursor-pointer"
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
        )}
      </div>

      {/* ── Pagination bar ── */}
      {!isLoading && !isError && pagination && (
        <div className="px-4 pb-2 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={PAGE_SIZE}
            isFetching={isFetching}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* ── Detail sheet ── */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-gray-50 dark:bg-gray-900 p-0">
          <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
            <SheetTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">Campaign Details</SheetTitle>
          </div>

          {selectedCampaign && (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {selectedCampaign.campaignName}
                </h3>
                <div className="flex items-center gap-3 flex-wrap">
                  {getStatusBadge(selectedCampaign.status)}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(selectedCampaign.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">Campaign Information</h4>
                <InfoRow label="Campaign ID"  value={<span className="font-mono">{selectedCampaign.campaignId}</span>} />
                <InfoRow label="Project ID"   value={<span className="font-mono">{selectedCampaign.projectId}</span>} />
                <InfoRow label="Provider"     value={selectedCampaign.callConfig.provider} />
              </div>

              {/* Agent */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">Agent Details</h4>
                <InfoRow label="Agent Name"  value={selectedCampaign.callConfig.agentName} />
                <InfoRow label="SIP Trunk"   value={<span className="font-mono">{selectedCampaign.callConfig.sipTrunkId}</span>} />
              </div>

              {/* Metrics */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-5">Performance Metrics</h4>
                <div className="space-y-4">
                  <MetricRow label="Total Contacts" value={selectedCampaign.callStats?.total   ?? selectedCampaign.totalContacts} />
                  <MetricRow label="Successful"      value={selectedCampaign.callStats?.completed ?? selectedCampaign.successCalls} color="text-green-600 dark:text-green-400" />
                  <MetricRow label="Failed"          value={selectedCampaign.callStats?.failed    ?? selectedCampaign.failedCalls}  color="text-red-600 dark:text-red-400" />
                  <MetricRow label="Pending"         value={selectedCampaign.callStats?.pending   ?? 0}                             color="text-gray-500 dark:text-gray-400" />
                </div>

                {/* Progress bar */}
                {(() => {
                  const total     = selectedCampaign.callStats?.total ?? selectedCampaign.processedContacts
                  const completed = selectedCampaign.callStats?.completed ?? selectedCampaign.successCalls
                  const rate      = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
                  return (
                    <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Completion Rate</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{rate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
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

function Stat({ label, value, color = 'text-gray-900 dark:text-gray-100' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 dark:text-gray-500">{label}:</span>
      <span className={`text-xs font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}

function MetricRow({ label, value, color = 'text-gray-900 dark:text-gray-100' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
    </div>
  )
}

export default Campaigns
