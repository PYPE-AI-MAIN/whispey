// app/[projectid]/campaigns/[campaignId]/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, RefreshCw, Phone, Calendar, Clock, Users, Pause, Play, Download, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Contact, RetryConfig } from '@/utils/campaigns/constants'
import { useProjectAgents } from '@/hooks/useProjectAgents'
import { resolveStoredAgentName } from '@/lib/agentDisplayName'

interface CampaignDetails {
  campaignId: string
  projectId: string
  campaignName: string
  status: string
  totalContacts: number
  processedContacts: number
  successCalls: number
  failedCalls: number
  callStats?: {
    pending: number
    completed: number
    failed: number
    total: number
  }
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

// ── DynamoDB-shaped log helpers (pure, no component state) ───────────────────

const hasDynamoShape = (v: any): boolean =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v) &&
  ['S', 'N', 'BOOL', 'M', 'L'].some(k => v[k] !== undefined)

const mapDynamoValues = (obj: Record<string, any>): Record<string, any> =>
  Object.fromEntries(Object.keys(obj).map(key => [key, parseDynamoDBValue(obj[key])]))

// Parse DynamoDB AttributeValue format into plain values.
function parseDynamoDBValue(value: any): any {
  if (value === null || value === undefined) return null
  // Already a plain value
  if (typeof value !== 'object' || Array.isArray(value)) return value

  if (value.S !== undefined) return value.S
  if (value.N !== undefined) return Number(value.N)
  if (value.BOOL !== undefined) return value.BOOL
  if (value.L !== undefined) return value.L.map((item: any) => parseDynamoDBValue(item))
  if (value.M !== undefined) return mapDynamoValues(value.M)

  // A regular object whose values are AttributeValues is a DynamoDB Map
  const keys = Object.keys(value)
  if (keys.length > 0 && hasDynamoShape(value[keys[0]])) return mapDynamoValues(value)
  return value
}

function parseAdditionalData(raw: unknown): any {
  if (typeof raw === 'string') {
    try { return parseDynamoDBValue(JSON.parse(raw)) } catch { return parseDynamoDBValue(raw) }
  }
  if (raw && typeof raw === 'object') return parseDynamoDBValue(raw)
  return {}
}

const STANDARD_COLUMNS = ['status', 'retryCount', 'lastCallAt']
const INTERNAL_KEYS = new Set(['contactId', 'campaignId', 'id', 'additionalData', 'name', 'email', 'phoneNumber', 'callAttempts'])
// additionalData columns that should appear right after status
const PRIORITY_ADDITIONAL_COLUMNS = ['appointment_time', 'doctor_name', 'patient_name', 'phone', 'appointment_date']
const HIDDEN_ADDITIONAL_KEYS = new Set(['name', 'email', 'callattempts'])

const bySort = (a: string, b: string) => a.localeCompare(b)

interface ColumnKeys {
  allKeys: Set<string>
  additionalDataKeys: Set<string>
  priorityAdditionalKeys: Set<string>
}

function collectDirectKeys(log: any, allKeys: Set<string>) {
  STANDARD_COLUMNS.forEach(key => { if (log[key] !== undefined) allKeys.add(key) })
  allKeys.add('retryCount') // always present: it's a DynamoDB column
  Object.keys(log).forEach(key => {
    if (!INTERNAL_KEYS.has(key) && !STANDARD_COLUMNS.includes(key)) allKeys.add(key)
  })
}

function collectAdditionalKeys(log: any, keys: ColumnKeys) {
  if (!log.additionalData) return
  const parsed = parseAdditionalData(log.additionalData)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
  Object.keys(parsed).forEach(key => {
    const lower = key.toLowerCase()
    if (STANDARD_COLUMNS.includes(key) || keys.allKeys.has(key) || HIDDEN_ADDITIONAL_KEYS.has(lower)) return
    const isPriority = PRIORITY_ADDITIONAL_COLUMNS.some(priority => priority.toLowerCase() === lower)
    ;(isPriority ? keys.priorityAdditionalKeys : keys.additionalDataKeys).add(key)
  })
}

// Pull the data key matching a priority column (case-insensitive) out of both sets.
function takePriorityKey(priorityCol: string, keys: ColumnKeys): string | undefined {
  const matches = (key: string) => key.toLowerCase() === priorityCol.toLowerCase()
  const found = Array.from(keys.priorityAdditionalKeys).find(matches) ?? Array.from(keys.additionalDataKeys).find(matches)
  if (found) {
    keys.priorityAdditionalKeys.delete(found)
    keys.additionalDataKeys.delete(found)
  }
  return found
}

// Status first, then priority additionalData columns, other standard columns, other columns, remaining additionalData columns.
function getAllColumns(logs: any[]): string[] {
  if (logs.length === 0) return []
  const keys: ColumnKeys = { allKeys: new Set(), additionalDataKeys: new Set(), priorityAdditionalKeys: new Set() }
  logs.forEach(log => {
    collectDirectKeys(log, keys.allKeys)
    collectAdditionalKeys(log, keys)
  })

  const finalColumns: string[] = []
  if (keys.allKeys.has('status')) finalColumns.push('status')
  PRIORITY_ADDITIONAL_COLUMNS.forEach(priorityCol => {
    const key = takePriorityKey(priorityCol, keys)
    if (key) finalColumns.push(key)
  })
  STANDARD_COLUMNS
    .filter(col => col !== 'status' && (keys.allKeys.has(col) || col === 'retryCount'))
    .forEach(col => finalColumns.push(col))
  Array.from(keys.allKeys)
    .filter(col => !STANDARD_COLUMNS.includes(col) && col !== 'status')
    .sort(bySort)
    .forEach(col => finalColumns.push(col))
  Array.from(keys.additionalDataKeys).sort(bySort).forEach(col => finalColumns.push(col))
  return finalColumns
}

// Value from the log itself, falling back to its additionalData.
function getValue(log: any, column: string) {
  if (log[column] !== undefined) return log[column]
  if (!log.additionalData) return null
  const data = parseAdditionalData(log.additionalData)
  return data && typeof data === 'object' ? data[column] : null
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-success/15 text-success',
  failed: 'bg-destructive/15 text-destructive',
  pending: 'bg-warning/15 text-warning',
  in_progress: 'bg-primary/15 text-primary',
}

const getStatusColor = (status: string) => STATUS_COLORS[status.toLowerCase()] ?? 'bg-muted text-foreground'

const DASH = <span className="text-muted-foreground">-</span>

function formatDateValue(value: string): string {
  try {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
  } catch {
    return value
  }
}

// Only treat a column as a date when its name says so; appointment_date and appointment_time show as-is.
function isDateColumn(columnLower: string): boolean {
  return (columnLower.endsWith('date') && columnLower !== 'appointment_date') ||
    (columnLower.endsWith('at') && columnLower !== 'appointment_time') ||
    ['createdat', 'updatedat', 'lastcallat', 'nextcallat'].includes(columnLower)
}

function formatGenericCell(column: string, value: any): React.ReactNode {
  const columnLower = column.toLowerCase()
  const isText = typeof value === 'string'
  if (columnLower.includes('phone') && isText) return <span className="font-mono text-xs">{value}</span>
  if (columnLower.includes('status') && isText) return <Badge className={getStatusColor(value)}>{value}</Badge>
  if (value && isText) return isDateColumn(columnLower) ? formatDateValue(value) : value
  if (typeof value === 'number') return value.toLocaleString()
  if (value === null || value === undefined) return DASH
  if (typeof value === 'object' && !Array.isArray(value)) {
    return <span className="text-xs text-muted-foreground">{JSON.stringify(value)}</span>
  }
  return value
}

function formatLastCallAt(value: any): React.ReactNode {
  if (!value) return DASH
  try {
    return new Date(value as string).toLocaleString()
  } catch {
    return value
  }
}

function formatCell(column: string, value: any): React.ReactNode {
  switch (column) {
    case 'status':
      return value ? <Badge className={getStatusColor(value)}>{value}</Badge> : DASH
    case 'retryCount':
      return value ?? 0
    case 'phoneNumber':
    case 'phone':
      return value ? <span className="font-mono text-xs">{value}</span> : DASH
    case 'lastCallAt':
      return formatLastCallAt(value)
    default:
      return formatGenericCell(column, value)
  }
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
  const [downloadStatusFilter, setDownloadStatusFilter] = useState('all')
  const [isDownloading, setIsDownloading] = useState(false)



  const { data: agents = [] } = useProjectAgents(projectId)
  const displayCampaignAgentName = campaignDetails
    ? resolveStoredAgentName(agents, campaignDetails.callConfig.agentName)
    : ''

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

  // Download contacts as CSV based on status filter
  const handleDownloadContacts = async () => {
    try {
      setIsDownloading(true)
      let allContacts: any[] = []
      let currentKey: string | null = null
      let hasMore = true

      // Fetch contacts with server-side filtering (paginate through all filtered pages)
      while (hasMore) {
        let url = `/api/campaigns/contacts?campaignId=${campaignId}&limit=100`
        
        // Add status filter to API call for server-side filtering
        if (downloadStatusFilter !== 'all') {
          url += `&status=${encodeURIComponent(downloadStatusFilter)}`
        }
        
        if (currentKey) {
          url += `&lastKey=${encodeURIComponent(currentKey)}`
        }

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('Failed to fetch contacts')
        }

        const data = await response.json()
        allContacts = [...allContacts, ...(data.contacts || [])]
        
        hasMore = data.pagination?.hasMore || false
        currentKey = data.pagination?.nextKey || null
      }

      // No need for client-side filtering anymore - already filtered by backend
      const filteredContacts = allContacts

      if (filteredContacts.length === 0) {
        alert('No contacts found with the selected status filter')
        return
      }

      // Get all unique keys from contacts to create CSV headers
      const directKeys = new Set<string>()
      const additionalDataKeys = new Set<string>()
      
      filteredContacts.forEach(contact => {
        // Add direct properties
        Object.keys(contact).forEach(key => {
          if (!['contactId', 'campaignId', 'id', 'additionalData'].includes(key)) {
            directKeys.add(key)
          }
        })
        
        // Parse and collect additionalData keys separately
        if (contact.additionalData) {
          try {
            let additionalData: any = {}
            if (typeof contact.additionalData === 'string') {
              try {
                const parsed = JSON.parse(contact.additionalData)
                additionalData = parseDynamoDBValue(parsed)
              } catch {
                additionalData = JSON.parse(contact.additionalData)
              }
            } else if (typeof contact.additionalData === 'object') {
              additionalData = parseDynamoDBValue(contact.additionalData)
            }
            
            if (additionalData && typeof additionalData === 'object') {
              Object.keys(additionalData).forEach(key => additionalDataKeys.add(key))
            }
          } catch (e) {
            console.warn('Failed to parse additionalData:', e)
          }
        }
      })

      // Create ordered column list with priorities
      // Priority order: status fields, then important additionalData fields, then other direct fields, then remaining additionalData
      const statusColumns = ['status', 'retryCount', 'lastCallAt']
      const priorityAdditionalColumns = ['phone', 'phoneNumber', 'patient_name', 'doctor_name', 'appointment_date', 'appointment_time', 'name', 'email']
      
      const columns: string[] = []
      
      // 1. Add status columns first
      statusColumns.forEach(col => {
        if (directKeys.has(col)) {
          columns.push(col)
          directKeys.delete(col)
        }
      })
      
      // 2. Add priority additionalData columns
      priorityAdditionalColumns.forEach(col => {
        if (additionalDataKeys.has(col)) {
          columns.push(col)
          additionalDataKeys.delete(col)
        }
      })
      
      // 3. Add remaining direct columns (sorted)
      Array.from(directKeys).sort((a, b) => a.localeCompare(b)).forEach(col => columns.push(col))

      // 4. Add remaining additionalData columns (sorted)
      Array.from(additionalDataKeys).sort((a, b) => a.localeCompare(b)).forEach(col => columns.push(col))

      // Log the columns being exported for debugging
      console.log('Exporting columns:', columns)
      console.log('Total columns:', columns.length)
      console.log('From additionalData:', Array.from(priorityAdditionalColumns.filter(c => columns.includes(c))).concat(Array.from(additionalDataKeys)))

      // Helper function to get value (same as getValue in render)
      const getValueForExport = (contact: any, column: string) => {
        if (contact[column] !== undefined) {
          return contact[column]
        }
        
        if (contact.additionalData) {
          try {
            let additionalData: any = {}
            if (typeof contact.additionalData === 'string') {
              try {
                const parsed = JSON.parse(contact.additionalData)
                additionalData = parseDynamoDBValue(parsed)
              } catch {
                additionalData = JSON.parse(contact.additionalData)
              }
            } else if (typeof contact.additionalData === 'object') {
              additionalData = parseDynamoDBValue(contact.additionalData)
            }
            return additionalData?.[column]
          } catch {
            return null
          }
        }
        return null
      }

      // Create CSV content
      const csvRows = [
        columns.join(','),
        ...filteredContacts.map(contact => 
          columns.map(col => {
            const value = getValueForExport(contact, col)
            if (value === null || value === undefined) return ''
            
            // Handle objects and arrays
            if (typeof value === 'object') {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`
            }
            
            // Escape quotes and wrap in quotes if contains comma or quotes
            const stringValue = String(value)
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`
            }
            return stringValue
          }).join(',')
        )
      ]

      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      const filterSuffix = downloadStatusFilter === 'all' ? 'all' : downloadStatusFilter
      link.setAttribute('download', `campaign-${campaignDetails?.campaignName || campaignId}-${filterSuffix}-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Count additionalData columns
      const additionalDataCount = Array.from(additionalDataKeys).length + priorityAdditionalColumns.filter(c => columns.includes(c)).length
      
      const filterInfo = downloadStatusFilter === 'all' 
        ? 'All contacts' 
        : `Filtered by: ${downloadStatusFilter}`
      
      alert(`Downloaded ${filteredContacts.length} contacts\n${filterInfo} (server-side filtered)\nTotal columns: ${columns.length}\n Columns from additionalData: ${additionalDataCount}\n\nCheck browser console for full column list.`)
    } catch (error: any) {
      console.error('Error downloading contacts:', error)
      alert('Failed to download contacts: ' + error.message)
    } finally {
      setIsDownloading(false)
    }
  }

  const columns = getAllColumns(logs)

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-card">
        {/* Header */}
        <div className="px-6 py-4 border-border bg-card border-b shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${projectId}/campaigns`)}
              className="h-7 w-7 p-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Campaign Details
            </h1>
          </div>
        </div>

        {/* Loading State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading campaign...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!campaignDetails) {
    return (
      <div className="flex flex-col h-screen bg-card">
        <div className="px-4 py-3 border-b border-border">
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
          <p className="text-sm text-muted-foreground">Campaign not found</p>
        </div>
      </div>
    )
  }

  const renderHeader = () => (
    <div className="px-6 py-4 border-border bg-card border-b shadow-sm">
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {campaignDetails.campaignName}
            </h1>
            <p className="text-xs text-muted-foreground">
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
              className="h-9 text-sm gap-2 px-4"
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
              className="h-9 text-sm gap-2 px-4"
            >
              <Play className="w-3 h-3" />
              {actionLoading ? 'Resuming...' : 'Resume'}
            </Button>
          )}
          {/* Download Section with Status Filter */}
          <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-lg border border-border">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={downloadStatusFilter}
              onChange={(e) => setDownloadStatusFilter(e.target.value)}
              disabled={isDownloading}
              className="h-7 px-2 text-xs border-0 focus:ring-0 focus:outline-none bg-transparent text-foreground font-medium cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="in_progress">In Progress</option>
            </select>
            <div className="h-4 w-px bg-muted-foreground/30"></div>
            <button
              onClick={handleDownloadContacts}
              disabled={isDownloading || logs.length === 0}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-success hover:text-success disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </>
              )}
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-9 text-sm gap-2 px-4"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  )

  // Campaign logs table body: loading / empty / populated. Extracted from a nested
  // ternary into if/else so each state reads as its own branch.
  let logsSection: React.ReactNode
  if (loadingLogs && logs.length === 0) {
    logsSection = (
      <div className="p-4 sm:p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading logs...</p>
      </div>
    )
  } else if (logs.length === 0) {
    logsSection = (
      <div className="p-4 sm:p-8 text-center">
        <p className="text-sm text-muted-foreground">No logs found</p>
      </div>
    )
  } else {
    logsSection = (
      <>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0 z-10">
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
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log, index) => (
                <tr
                  key={log.contactId || log.id || index}
                  className="hover:bg-muted/50"
                >
                  {columns.map((column) => {
                    const displayValue = formatCell(column, getValue(log, column))

                    return (
                      <td
                        key={column}
                        className="px-4 py-3 text-xs text-foreground"
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
          <div className="px-4 py-3 border-t border-border text-center">
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
    )
  }

  return (
    <div className="flex flex-col h-screen bg-card">
      {/* Header */}
      {renderHeader()}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Total Contacts</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {campaignDetails.callStats?.total ?? campaignDetails.totalContacts}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-muted-foreground">Processed</span>
              </div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {campaignDetails.processedContacts}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-green-400" />
                <span className="text-xs font-medium text-muted-foreground">Success</span>
              </div>
              <p className="text-2xl font-bold text-success">
                {campaignDetails.callStats?.completed ?? campaignDetails.successCalls}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-red-400" />
                <span className="text-xs font-medium text-muted-foreground">Failed</span>
              </div>
              <p className="text-2xl font-bold text-destructive">
                {campaignDetails.callStats?.failed ?? campaignDetails.failedCalls}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-muted-foreground">Pending</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                {campaignDetails.callStats?.pending ?? 0}
              </p>
            </div>
          </div>

          {/* Campaign Info */}
          <div className="rounded-xl border border-border bg-card shadow-sm p-4">
            <h2 className="text-xs font-medium text-muted-foreground mb-3">
              Campaign Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge className={getStatusColor(campaignDetails.status)}>
                  {campaignDetails.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Agent</p>
                <p className="text-sm font-medium text-foreground">
                  {displayCampaignAgentName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Provider</p>
                <p className="text-sm font-medium text-foreground">
                  {campaignDetails.callConfig.provider}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Schedule
                </p>
                <p className="text-sm font-medium text-foreground">
                  {campaignDetails.schedule?.days && Array.isArray(campaignDetails.schedule.days) 
                    ? campaignDetails.schedule.days.join(', ')
                    : 'Not scheduled'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Time Window
                </p>
                <p className="text-sm font-medium text-foreground">
                  {campaignDetails.schedule?.startTime && campaignDetails.schedule?.endTime
                    ? `${campaignDetails.schedule.startTime} - ${campaignDetails.schedule.endTime}`
                    : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Timezone</p>
                <p className="text-sm font-medium text-foreground">
                  {campaignDetails.schedule?.timezone || 'Not set'}
                </p>
              </div>
            </div>

            {/* Retry Configuration */}
            {campaignDetails.schedule?.retryConfig && Array.isArray(campaignDetails.schedule.retryConfig) && campaignDetails.schedule.retryConfig.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3" />
                  Retry Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {campaignDetails.schedule.retryConfig.map((config) => {
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
                    } else if (config.type === 'metadata' && config.fieldName) {
                      displayLabel = `Metadata: ${config.fieldName} ${config.operator || ''}`
                    } else {
                      displayLabel = 'Unknown retry type'
                    }
                    
                    const label = displayLabel
                    const configKey = `${config.type}-${config.errorCodes?.[0] ?? ''}-${config.metricName ?? config.fieldName ?? ''}-${config.delayMinutes}-${config.maxRetries}`

                    return (
                      <div
                        key={configKey}
                        className="p-3 bg-muted/50 border border-border rounded-md"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-foreground">
                            {config.type === 'sipCode' && config.errorCodes?.[0] ? config.errorCodes[0] : config.type || 'Retry'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Delay:</span>
                            <span className="ml-1 font-medium text-foreground">
                              {config.delayMinutes} min
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Retries:</span>
                            <span className="ml-1 font-medium text-foreground">
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
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-xs font-medium text-muted-foreground">
                Campaign Logs ({logs.length})
              </h2>
            </div>

            {logsSection}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewCampaign