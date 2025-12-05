'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Phone, User, Calendar, Search, Loader2, MoreVertical, RefreshCw, Pause, Play, Trash2 } from 'lucide-react'
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

function Campaigns() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectid as string

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/campaigns/list?projectId=${projectId}&limit=50`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns')
      }

      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      alert('Failed to load campaigns')
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) {
      fetchCampaigns()
    }
  }, [projectId])

  const filteredCampaigns = campaigns
    .filter(campaign => 
      campaign.campaignName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.campaignId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.callConfig.agentName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
      running: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
      paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      scheduled: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800',
      ready: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
    }

    const statusKey = status.toLowerCase() as keyof typeof statusConfig
    const statusClass = statusConfig[statusKey] || statusConfig.active

    return (
      <Badge variant="outline" className={`${statusClass} text-xs`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const handleCreateCampaign = () => {
    router.push(`/${projectId}/campaigns/create`)
  }

  const handleViewInfo = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCampaign(campaign)
    setIsSheetOpen(true)
  }

  const handleCampaignClick = (campaignId: string) => {
    router.push(`/${projectId}/campaigns/${campaignId}`)
  }

  const handlePauseCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to pause this campaign?')) return
    
    try {
      setActionLoading(campaignId)
      const response = await fetch('/api/campaigns/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to pause campaign')
      }
      
      await fetchCampaigns()
    } catch (error: any) {
      alert(error.message || 'Failed to pause campaign')
    } finally {
      setActionLoading(null)
    }
  }

  const handleResumeCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to resume this campaign?')) return
    
    try {
      setActionLoading(campaignId)
      const response = await fetch('/api/campaigns/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resume campaign')
      }
      
      await fetchCampaigns()
    } catch (error: any) {
      alert(error.message || 'Failed to resume campaign')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) return
    
    try {
      setActionLoading(campaignId)
      const response = await fetch(`/api/campaigns/delete?campaignId=${campaignId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete campaign')
      }
      
      await fetchCampaigns()
    } catch (error: any) {
      alert(error.message || 'Failed to delete campaign')
    } finally {
      setActionLoading(null)
    }
  }

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3">
        <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
        No campaigns yet
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3 max-w-sm">
        Get started by creating your first campaign to manage phone calls and track performance.
      </p>
      <Button onClick={handleCreateCampaign} size="sm" className="h-7 text-xs gap-2">
        <Plus className="w-3 h-3" />
        Create Your First Campaign
      </Button>
    </div>
  )

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Campaigns</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Manage and monitor your calling campaigns
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading campaigns...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Campaigns</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage and monitor your calling campaigns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={fetchCampaigns} 
              variant="outline"
              size="sm" 
              className="h-7 text-xs gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
            <Button onClick={handleCreateCampaign} size="sm" className="h-7 text-xs gap-2">
              <Plus className="w-3 h-3" />
              Create Campaign
            </Button>
          </div>
        </div>
      </div>

      {campaigns.length > 0 && (
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 p-4">
        {campaigns.length === 0 ? (
          <EmptyState />
        ) : filteredCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3">
              <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              No campaigns match your search
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-sm">
              Try adjusting your search criteria
            </p>
            <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="text-xs h-7">
              Clear Search
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.campaignId}
                onClick={() => handleCampaignClick(campaign.campaignId)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {campaign.campaignName}
                      </h3>
                      {getStatusBadge(campaign.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
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
                    
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-500">Total:</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{campaign.totalContacts}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-500">Processed:</span>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{campaign.processedContacts}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-gray-500 dark:text-gray-500">Success:</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 max-w-[100px]">
                          <div 
                            className="bg-green-500 dark:bg-green-600 h-1.5 rounded-full transition-all"
                            style={{ 
                              width: campaign.processedContacts > 0 
                                ? `${Math.min(100, Math.max(0, (campaign.successCalls / campaign.processedContacts) * 100))}%`
                                : '0%'
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {campaign.processedContacts > 0 
                            ? Math.min(100, Math.max(0, Math.round((campaign.successCalls / campaign.processedContacts) * 100)))
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-1 flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-70 group-hover:opacity-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewInfo(campaign, e); }} className="text-xs cursor-pointer">
                          View Details
                        </DropdownMenuItem>
                        {(campaign.status === 'scheduled' || campaign.status === 'running') && (
                          <DropdownMenuItem 
                            onClick={(e) => handlePauseCampaign(campaign.campaignId, e)} 
                            className="text-xs cursor-pointer"
                            disabled={actionLoading === campaign.campaignId}
                          >
                            <Pause className="w-3 h-3 mr-2" />
                            {actionLoading === campaign.campaignId ? 'Pausing...' : 'Pause'}
                          </DropdownMenuItem>
                        )}
                        {campaign.status === 'paused' && (
                          <DropdownMenuItem 
                            onClick={(e) => handleResumeCampaign(campaign.campaignId, e)} 
                            className="text-xs cursor-pointer"
                            disabled={actionLoading === campaign.campaignId}
                          >
                            <Play className="w-3 h-3 mr-2" />
                            {actionLoading === campaign.campaignId ? 'Resuming...' : 'Resume'}
                          </DropdownMenuItem>
                        )}
                        {(campaign.status === 'paused' || campaign.status === 'draft' || campaign.status === 'completed' || campaign.status === 'ready') && (
                          <DropdownMenuItem 
                            onClick={(e) => handleDeleteCampaign(campaign.campaignId, e)} 
                            className="text-xs text-red-600 dark:text-red-400 cursor-pointer"
                            disabled={actionLoading === campaign.campaignId}
                          >
                            <Trash2 className="w-3 h-3 mr-2" />
                            {actionLoading === campaign.campaignId ? 'Deleting...' : 'Delete'}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-gray-50 dark:bg-gray-900 p-0">
          <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
            <SheetTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">Campaign Details</SheetTitle>
          </div>
          
          {selectedCampaign && (
            <div className="p-6 space-y-6">
              {/* Campaign Header Card */}
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
              
              {/* Campaign Information */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
                  Campaign Information
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Campaign ID</span>
                    <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">{selectedCampaign.campaignId}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Project ID</span>
                    <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">{selectedCampaign.projectId}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Provider</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedCampaign.callConfig.provider}</span>
                  </div>
                </div>
              </div>
              
              {/* Agent Details */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
                  Agent Details
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Agent Name</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedCampaign.callConfig.agentName}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">SIP Trunk ID</span>
                    <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">{selectedCampaign.callConfig.sipTrunkId}</span>
                  </div>
                </div>
              </div>
              
              {/* Performance Metrics */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-5">
                  Performance Metrics
                </h4>
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Contacts</span>
                    <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{selectedCampaign.totalContacts}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Successful Calls</span>
                    <span className="text-3xl font-bold text-green-600 dark:text-green-400">{selectedCampaign.successCalls}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed Calls</span>
                    <span className="text-3xl font-bold text-red-600 dark:text-red-400">{selectedCampaign.failedCalls}</span>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Success Rate</span>
                      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {selectedCampaign.processedContacts > 0 
                          ? Math.min(100, Math.max(0, Math.round((selectedCampaign.successCalls / selectedCampaign.processedContacts) * 100)))
                          : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-green-500 dark:bg-green-600 h-3 rounded-full transition-all"
                        style={{ 
                          width: selectedCampaign.processedContacts > 0 
                            ? `${Math.min(100, Math.max(0, (selectedCampaign.successCalls / selectedCampaign.processedContacts) * 100))}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Button */}
              <Button 
                onClick={() => {
                  setIsSheetOpen(false)
                  handleCampaignClick(selectedCampaign.campaignId)
                }}
                className="w-full text-sm h-11 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold shadow-sm"
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

export default Campaigns