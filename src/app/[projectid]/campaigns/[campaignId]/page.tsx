// app/[projectid]/campaigns/[campaignId]/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, RefreshCw, Phone, Calendar, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Contact, RetryConfig } from '@/utils/campaigns/constants'

interface CampaignDetails {
  campaignId: string
  projectId: string
  campaignName: string
  status: string
  totalContacts: number
  processedContacts: number
  successCalls: number
  failedCalls: number
  schedule: {
    days: string[]
    startTime: string
    endTime: string
    timezone: string
    enabled: boolean
    frequency: number
    retryConfig?: RetryConfig[]
  }
  callConfig: {
    agentName: string
    provider: string
    sipTrunkId: string
  }
  createdAt: string
  updatedAt: string
}

function ViewCampaign() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectid as string
  const campaignId = params.campaignId as string

  const [loading, setLoading] = useState(true)
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [campaignDetails, setCampaignDetails] = useState<CampaignDetails | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextKey, setNextKey] = useState<string | null>(null)



  const sanitizedCampaignAgentName = (campaignDetails?.callConfig.agentName.split('_')[0] || '').replace(/[^a-zA-Z0-9]/g, '')

  // Fetch campaign details
  const fetchCampaignDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/campaigns/list?projectId=${projectId}&limit=50`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaign details')
      }

      const data = await response.json()
      const campaign = data.campaigns?.find((c: any) => c.campaignId === campaignId)
      
      if (campaign) {
        setCampaignDetails(campaign)
      } else {
        alert('Campaign not found')
        router.push(`/${projectId}/campaigns`)
      }
    } catch (error) {
      console.error('Error fetching campaign:', error)
      alert('Failed to load campaign details')
    } finally {
      setLoading(false)
    }
  }

  // Fetch contacts
  const fetchContacts = async (lastKey?: string) => {
    try {
      setLoadingContacts(true)
      let url = `/api/campaigns/contacts?campaignId=${campaignId}&limit=50`
      
      if (lastKey) {
        url += `&lastKey=${lastKey}`
      }

      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }

      const data = await response.json()
      
      if (lastKey) {
        // Append to existing contacts for pagination
        setContacts(prev => [...prev, ...(data.contacts || [])])
      } else {
        // Replace contacts for initial load or refresh
        setContacts(data.contacts || [])
      }
      
      setHasMore(data.pagination?.hasMore || false)
      setNextKey(data.pagination?.nextKey || null)
    } catch (error) {
      console.error('Error fetching contacts:', error)
      alert('Failed to load contacts')
    } finally {
      setLoadingContacts(false)
    }
  }

  useEffect(() => {
    fetchCampaignDetails()
    fetchContacts()
  }, [campaignId, projectId])

  const handleRefresh = () => {
    fetchCampaignDetails()
    fetchContacts()
  }

  const handleLoadMore = () => {
    if (nextKey && !loadingContacts) {
      fetchContacts(nextKey)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${projectId}/campaigns`)}
              className="h-7 w-7 p-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Campaign Details
            </h1>
          </div>
        </div>

        {/* Loading State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading campaign...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!campaignDetails) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${projectId}/campaigns`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Campaign not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${projectId}/campaigns`)}
              className="h-7 w-7 p-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {campaignDetails.campaignName}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Campaign ID: {campaignDetails.campaignId}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-7 text-xs gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Contacts</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {campaignDetails.totalContacts}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Processed</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {campaignDetails.processedContacts}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-green-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Success</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {campaignDetails.successCalls}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-red-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Failed</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {campaignDetails.failedCalls}
              </p>
            </div>
          </div>

          {/* Campaign Info */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Campaign Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                <Badge className={getStatusColor(campaignDetails.status)}>
                  {campaignDetails.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Agent</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {sanitizedCampaignAgentName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Provider</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {campaignDetails.callConfig.provider}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Schedule
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {campaignDetails.schedule.days.join(', ')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Time Window
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {campaignDetails.schedule.startTime} - {campaignDetails.schedule.endTime}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Timezone</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {campaignDetails.schedule.timezone}
                </p>
              </div>
            </div>

            {/* Retry Configuration */}
            {campaignDetails.schedule.retryConfig && campaignDetails.schedule.retryConfig.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3" />
                  Retry Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {campaignDetails.schedule.retryConfig.map((config, index) => {
                    const errorCode = config.errorCodes[0]
                    const errorLabels: { [key: string]: string } = {
                      '480': 'Temporarily Unavailable',
                      '486': 'Busy Here',
                    }
                    const label = errorLabels[errorCode] || errorCode

                    return (
                      <div 
                        key={index} 
                        className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {errorCode}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Delay:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">
                              {config.delayMinutes} min
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Retries:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">
                              {config.maxRetries}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Contacts Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Contacts ({contacts.length})
              </h2>
            </div>

            {loadingContacts && contacts.length === 0 ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading contacts...</p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">No contacts found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
                          Phone Number
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
                          Attempts
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
                          Last Call
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {contacts.map((contact) => (
                        <tr 
                          key={contact.contactId}
                          className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                        >
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                            {contact.name}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                            {contact.phoneNumber}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={getStatusColor(contact.status)}>
                              {contact.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                            {contact.callAttempts}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {contact.lastCallAt 
                              ? new Date(contact.lastCallAt).toLocaleString()
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Load More Button */}
                {hasMore && (
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={loadingContacts}
                      className="text-xs"
                    >
                      {loadingContacts ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewCampaign