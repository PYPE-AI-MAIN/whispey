// app/[projectid]/campaigns/[campaignId]/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, RefreshCw, Phone, Calendar, Clock, Users, Pause, Play } from 'lucide-react'
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
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [campaignDetails, setCampaignDetails] = useState<CampaignDetails | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [hasMoreLogs, setHasMoreLogs] = useState(false)
  const [nextKey, setNextKey] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)



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
      setLoadingLogs(true)
      let url = `/api/campaigns/contacts?campaignId=${campaignId}&limit=100`
      
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
        setLogs(prev => [...prev, ...(data.contacts || [])])
      } else {
        // Replace contacts for initial load or refresh
        setLogs(data.contacts || [])
      }
      
      setHasMoreLogs(data.pagination?.hasMore || false)
      setNextKey(data.pagination?.nextKey || null)
    } catch (error) {
      console.error('Error fetching contacts:', error)
      alert('Failed to load contacts')
    } finally {
      setLoadingLogs(false)
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

  const handlePauseCampaign = async () => {
    if (!confirm('Are you sure you want to pause this campaign?')) return
    
    try {
      setActionLoading(true)
      const response = await fetch('/api/campaigns/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to pause campaign')
      }
      
      await fetchCampaignDetails()
      alert('Campaign paused successfully')
    } catch (error: any) {
      alert(error.message || 'Failed to pause campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResumeCampaign = async () => {
    if (!confirm('Are you sure you want to resume this campaign?')) return
    
    try {
      setActionLoading(true)
      const response = await fetch('/api/campaigns/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resume campaign')
      }
      
      await fetchCampaignDetails()
      alert('Campaign resumed successfully')
    } catch (error: any) {
      alert(error.message || 'Failed to resume campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLoadMore = () => {
    if (nextKey && !loadingLogs) {
      fetchContacts(nextKey)
    }
  }

  // Helper function to parse DynamoDB AttributeValue format
  const parseDynamoDBValue = (value: any): any => {
    if (value === null || value === undefined) {
      return null
    }
    
    // If it's already a plain value, return it
    if (typeof value !== 'object' || Array.isArray(value)) {
      return value
    }
    
    // Check if it's DynamoDB AttributeValue format
    if (value.S !== undefined) {
      return value.S // String
    } else if (value.N !== undefined) {
      return Number(value.N) // Number
    } else if (value.BOOL !== undefined) {
      return value.BOOL // Boolean
    } else if (value.L !== undefined) {
      return value.L.map((item: any) => parseDynamoDBValue(item)) // List
    } else if (value.M !== undefined) {
      const result: any = {}
      Object.keys(value.M).forEach(key => {
        result[key] = parseDynamoDBValue(value.M[key])
      })
      return result // Map
    }
    
    // If it's a regular object, check if it's a DynamoDB Map (all values are AttributeValues)
    const keys = Object.keys(value)
    if (keys.length > 0) {
      const firstKey = keys[0]
      const firstValue = value[firstKey]
      // Check if first value looks like DynamoDB AttributeValue (has S, N, BOOL, etc.)
      if (firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue) &&
          (firstValue.S !== undefined || firstValue.N !== undefined || firstValue.BOOL !== undefined || 
           firstValue.M !== undefined || firstValue.L !== undefined)) {
        // It's a DynamoDB Map format
        const result: any = {}
        Object.keys(value).forEach(key => {
          result[key] = parseDynamoDBValue(value[key])
        })
        return result
      }
    }
    
    // Regular object, return as-is
    return value
  }

  // Get all unique keys from logs to create dynamic columns
  const getAllColumns = () => {
    if (logs.length === 0) return []
    
    // Define the standard columns order
    const standardColumns = ['status', 'retryCount', 'lastCallAt']
    // Define priority additionalData columns that should appear at the beginning
    const priorityAdditionalColumns = ['appointment_time', 'doctor_name', 'patient_name', 'phone', 'appointment_date']
    const allKeys = new Set<string>()
    const additionalDataKeys = new Set<string>()
    const priorityAdditionalKeys = new Set<string>()
    
    logs.forEach(log => {
      // Add standard columns if they exist
      standardColumns.forEach(key => {
        if (log[key] !== undefined) {
          allKeys.add(key)
        }
      })
      
      // Always add retryCount (it's a DynamoDB column)
      allKeys.add('retryCount')
      
      // Add other direct keys (excluding internal fields and additionalData)
      Object.keys(log).forEach(key => {
        if (!['contactId', 'campaignId', 'id', 'additionalData', 'name', 'email', 'phoneNumber', 'callAttempts'].includes(key) && 
            !standardColumns.includes(key)) {
          allKeys.add(key)
        }
      })
      
      // Parse additionalData if it exists and collect its keys separately
      if (log.additionalData) {
        try {
          let parsedData: any = {}
          
          // Handle both string and object formats
          if (typeof log.additionalData === 'string') {
            try {
              const parsed = JSON.parse(log.additionalData)
              parsedData = parseDynamoDBValue(parsed)
            } catch (parseError) {
              // If JSON parsing fails, try to parse as DynamoDB format directly
              parsedData = parseDynamoDBValue(log.additionalData)
            }
          } else if (typeof log.additionalData === 'object') {
            parsedData = parseDynamoDBValue(log.additionalData)
          }
          
          // Debug: Log the parsed data structure
          if (logs.indexOf(log) === 0) {
            console.log('First log additionalData (raw):', log.additionalData)
            console.log('First log additionalData (parsed):', parsedData)
            console.log('Parsed keys:', parsedData ? Object.keys(parsedData) : [])
          }
          
          // Ensure parsedData is an object with keys
          if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
            // Collect keys from additionalData
            Object.keys(parsedData).forEach(key => {
              // Don't add if it's already a standard column, already in allKeys, or is excluded (name, email, callAttempts)
              if (!standardColumns.includes(key) && !allKeys.has(key) && 
                  !['name', 'email', 'callattempts'].includes(key.toLowerCase())) {
                // Check if it's a priority column (case-insensitive match)
                const keyLower = key.toLowerCase()
                const isPriority = priorityAdditionalColumns.some(priority => priority.toLowerCase() === keyLower)
                
                if (isPriority) {
                  // Store with original case from data
                  priorityAdditionalKeys.add(key)
                  if (logs.indexOf(log) === 0) {
                    console.log(`Added priority key: ${key} (matches ${priorityAdditionalColumns.find(p => p.toLowerCase() === keyLower)})`)
                  }
                } else {
                  additionalDataKeys.add(key)
                }
              } else if (logs.indexOf(log) === 0) {
                console.log(`Skipped key: ${key} (standard: ${standardColumns.includes(key)}, in allKeys: ${allKeys.has(key)}, excluded: ${['name', 'email'].includes(key.toLowerCase())})`)
              }
            })
          }
        } catch (e) {
          // If parsing fails, log error but continue
          console.warn('Failed to parse additionalData:', e, 'Raw data:', log.additionalData)
        }
      }
    })
    
    // Build final column array: status first, then priority additionalData columns, then other standard columns, then other columns, then remaining additionalData columns
    const finalColumns: string[] = []
    
    // Add status first if it exists
    if (allKeys.has('status')) {
      finalColumns.push('status')
    }
    
    // Add priority additionalData columns after status (in order)
    priorityAdditionalColumns.forEach(priorityCol => {
      // Find matching key from data (case-insensitive)
      const matchingKey = Array.from(priorityAdditionalKeys).find(key => 
        key.toLowerCase() === priorityCol.toLowerCase()
      ) || Array.from(additionalDataKeys).find(key => 
        key.toLowerCase() === priorityCol.toLowerCase()
      )
      
      if (matchingKey) {
        finalColumns.push(matchingKey)
        // Remove from both sets if present
        priorityAdditionalKeys.delete(matchingKey)
        additionalDataKeys.delete(matchingKey)
      }
    })
    
    // Debug: Log what we found
    if (priorityAdditionalKeys.size > 0 || additionalDataKeys.size > 0) {
      console.log('Priority keys found:', Array.from(priorityAdditionalKeys))
      console.log('Additional data keys found:', Array.from(additionalDataKeys))
    }
    
    // Add other standard columns (excluding status which we already added)
    standardColumns.forEach(col => {
      if (col !== 'status' && (allKeys.has(col) || col === 'retryCount')) {
        finalColumns.push(col)
      }
    })
    
    // Add other columns (excluding standard ones)
    Array.from(allKeys)
      .filter(col => !standardColumns.includes(col) && col !== 'status')
      .sort()
      .forEach(col => finalColumns.push(col))
    
    // Add remaining additionalData columns at the end
    Array.from(additionalDataKeys)
      .sort()
      .forEach(col => finalColumns.push(col))
    
    return finalColumns
  }

  const columns = getAllColumns()
  
  // Helper function to get value from log (checks additionalData if not found in main object)
  const getValue = (log: any, column: string) => {
    // First check if it's a direct property
    if (log[column] !== undefined) {
      return log[column]
    }
    
    // If not found, check inside additionalData
    if (log.additionalData) {
      try {
        let additionalData: any = {}
        
        // Handle DynamoDB AttributeValue format
        if (typeof log.additionalData === 'string') {
          try {
            const parsed = JSON.parse(log.additionalData)
            additionalData = parseDynamoDBValue(parsed)
          } catch {
            // If parsing fails, try as regular object
            additionalData = JSON.parse(log.additionalData)
          }
        } else if (typeof log.additionalData === 'object') {
          additionalData = parseDynamoDBValue(log.additionalData)
        }
        
        return additionalData?.[column]
      } catch {
        return null
      }
    }
    
    return null
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
          <div className="flex items-center gap-2">
            {(campaignDetails?.status === 'scheduled' || campaignDetails?.status === 'running') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePauseCampaign}
                disabled={actionLoading}
                className="h-7 text-xs gap-1.5"
              >
                <Pause className="w-3 h-3" />
                {actionLoading ? 'Pausing...' : 'Pause'}
              </Button>
            )}
            {campaignDetails?.status === 'paused' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResumeCampaign}
                disabled={actionLoading}
                className="h-7 text-xs gap-1.5"
              >
                <Play className="w-3 h-3" />
                {actionLoading ? 'Resuming...' : 'Resume'}
              </Button>
            )}
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
                  {campaignDetails.schedule?.days && Array.isArray(campaignDetails.schedule.days) 
                    ? campaignDetails.schedule.days.join(', ')
                    : 'Not scheduled'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Time Window
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {campaignDetails.schedule?.startTime && campaignDetails.schedule?.endTime
                    ? `${campaignDetails.schedule.startTime} - ${campaignDetails.schedule.endTime}`
                    : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Timezone</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {campaignDetails.schedule?.timezone || 'Not set'}
                </p>
              </div>
            </div>

            {/* Retry Configuration */}
            {campaignDetails.schedule?.retryConfig && Array.isArray(campaignDetails.schedule.retryConfig) && campaignDetails.schedule.retryConfig.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3" />
                  Retry Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {campaignDetails.schedule.retryConfig.map((config, index) => {
                    // Handle different retry types
                    let displayLabel = ''
                    if (config.type === 'sipCode' && config.errorCodes && Array.isArray(config.errorCodes) && config.errorCodes.length > 0) {
                      const errorCode = config.errorCodes[0]
                      const errorLabels: { [key: string]: string } = {
                        '480': 'Temporarily Unavailable',
                        '486': 'Busy Here',
                      }
                      displayLabel = errorLabels[String(errorCode)] || String(errorCode)
                    } else if (config.type === 'metric' && config.metricName) {
                      displayLabel = `Metric: ${config.metricName} ${config.operator || ''} ${config.threshold ?? ''}`
                    } else if (config.type === 'fieldExtractor' && config.fieldName) {
                      displayLabel = `Field: ${config.fieldName} ${config.operator || ''}`
                    } else {
                      displayLabel = 'Unknown retry type'
                    }
                    
                    const label = displayLabel

                    return (
                      <div 
                        key={index} 
                        className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {config.type === 'sipCode' && config.errorCodes?.[0] ? config.errorCodes[0] : config.type || 'Retry'}
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

          {/* Campaign Logs Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Campaign Logs ({logs.length})
              </h2>
            </div>

            {loadingLogs && logs.length === 0 ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">No logs found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                      <tr>
                        {columns.map((column) => {
                          // Map column names to display labels
                          const columnLabels: { [key: string]: string } = {
                            'status': 'Status',
                            'retryCount': 'Retry Count',
                            'lastCallAt': 'Last Call',
                          }
                          
                          const label = columnLabels[column] || 
                            column.split(/(?=[A-Z])/).map(word => 
                              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                            ).join(' ')
                          
                          return (
                            <th 
                              key={column}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap"
                            >
                              {label}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {logs.map((log, index) => (
                        <tr 
                          key={log.contactId || log.id || index}
                          className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                        >
                          {columns.map((column) => {
                            const value = getValue(log, column)
                            let displayValue: React.ReactNode = value

                            // Handle specific column mappings
                            if (column === 'status') {
                              displayValue = value ? (
                                <Badge className={getStatusColor(value)}>
                                  {value}
                                </Badge>
                              ) : <span className="text-gray-400">-</span>
                            } else if (column === 'retryCount') {
                              displayValue = value !== undefined && value !== null ? value : 0
                            } else if (column === 'phoneNumber' || column === 'phone') {
                              displayValue = value ? <span className="font-mono text-xs">{value}</span> : <span className="text-gray-400">-</span>
                            } else if (column === 'lastCallAt') {
                              if (value) {
                                try {
                                  displayValue = new Date(value as string).toLocaleString()
                                } catch {
                                  displayValue = value
                                }
                              } else {
                                displayValue = <span className="text-gray-400">-</span>
                              }
                            } else {
                              // Format phone numbers
                              if (column.toLowerCase().includes('phone') && typeof value === 'string') {
                                displayValue = <span className="font-mono text-xs">{value}</span>
                              }
                              // Format status with badge
                              else if (column.toLowerCase().includes('status') && typeof value === 'string') {
                                displayValue = (
                                  <Badge className={getStatusColor(value)}>
                                    {value}
                                  </Badge>
                                )
                              }
                              // Format dates - be more specific to avoid false positives
                              else if (value && typeof value === 'string') {
                                // Only format as date if column name explicitly indicates it's a date/time field
                                // Exclude appointment_date and appointment_time - show them as-is
                                const columnLower = column.toLowerCase()
                                const isDateColumn = (columnLower.endsWith('date') && columnLower !== 'appointment_date') || 
                                                   (columnLower.endsWith('at') && columnLower !== 'appointment_time') ||
                                                   columnLower === 'createdat' ||
                                                   columnLower === 'updatedat' ||
                                                   columnLower === 'lastcallat' ||
                                                   columnLower === 'nextcallat'
                                
                                if (isDateColumn) {
                                  try {
                                    const dateValue = new Date(value)
                                    if (!isNaN(dateValue.getTime())) {
                                      displayValue = dateValue.toLocaleString()
                                    } else {
                                      displayValue = value
                                    }
                                  } catch {
                                    displayValue = value
                                  }
                                } else {
                                  // For non-date columns (including appointment_date and appointment_time), just display the value as-is
                                  displayValue = value
                                }
                              }
                              // Format numbers
                              else if (typeof value === 'number') {
                                displayValue = value.toLocaleString()
                              }
                              // Handle null/undefined
                              else if (value === null || value === undefined) {
                                displayValue = <span className="text-gray-400">-</span>
                              }
                              // Handle objects
                              else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                displayValue = <span className="text-xs text-gray-500">{JSON.stringify(value)}</span>
                              }
                            }

                            return (
                              <td 
                                key={column}
                                className="px-4 py-3 text-xs text-gray-900 dark:text-gray-100"
                              >
                                {displayValue}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Load More Button */}
                {hasMoreLogs && (
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={loadingLogs}
                      className="text-xs"
                    >
                      {loadingLogs ? (
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